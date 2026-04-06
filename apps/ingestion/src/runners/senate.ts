/**
 * Senate of Canada voting records ingestion pipeline
 *
 * Phases:
 *   A — Scrape vote listing pages for all 12 sessions (39th–45th Parliament)
 *   B — Senator entity matching via senatorId-anchored senator_profiles
 *   C — Scrape vote detail pages for per-senator ballots (resumable)
 *
 * Note: sencanada.ca has no public API. Data is scraped from HTML with 200ms delay
 * between requests to respect Cloudflare protection (Pitfall 4 in RESEARCH.md).
 */
import { sql, eq } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { senatorProfiles, parliamentVotes, parliamentVoteBallots } from '@govtrace/db/schema/parliament'
import {
  SENATE_SESSIONS,
  fetchSenateVoteListingHtml,
  fetchSenateVoteDetailHtml,
} from '../downloaders/senate.ts'
import { parseSenateVoteListingHtml } from '../parsers/senate-votes.ts'
import { parseSenateVoteDetailHtml } from '../parsers/senate-ballots.ts'
import { upsertSenateVotes, markSenateBallotsIngested, buildSenateVoteId } from '../upsert/senate-votes.ts'
import { buildSenateBallotRecords, upsertSenateBallots } from '../upsert/senate-ballots.ts'
import { normalizeName } from '../normalizer/normalize.ts'
import { findDeterministicMatch, createNewEntity } from '../matcher/deterministic.ts'
import { findFuzzyMatches, storeHighConfidenceMatch } from '../matcher/fuzzy.ts'
import { verifyMatchWithAI } from '../matcher/ai-verify.ts'

/**
 * Strips common honorific prefixes from senator names before matching.
 * Canadian senators often have "Hon.", "The Hon.", "Right Hon." prefixes.
 */
function stripSenatorHonorifics(name: string): string {
  return name
    .replace(/^(Right Hon\.|Right Honourable|The Hon\.|Hon\.|Honourable|Mr\.|Mrs\.|Ms\.|Miss|Dr\.|Prof\.)\s+/i, '')
    .trim()
}

interface SenatorRecord {
  senatorId: number
  firstName: string
  lastName: string
  province: string
  groupAffiliation: string
}

/**
 * Match a single senator to an entity via deterministic → fuzzy → AI fallback.
 * Returns entityId (existing or newly created).
 * Mirrors matchMpToEntity from parliament.ts runner, adapted for Senate context.
 */
async function matchSenatorToEntity(senator: SenatorRecord): Promise<{
  entityId: string
  matchMethod: string
  matchConfidence: number
}> {
  const fullName = `${senator.firstName} ${senator.lastName}`.trim()
  const cleanName = stripSenatorHonorifics(fullName)

  // Stage 1: Deterministic match on normalized name
  const deterministicResult = await findDeterministicMatch(cleanName, 'senator_profiles', 'person_name')
  if (deterministicResult) {
    return {
      entityId: deterministicResult.entityId,
      matchMethod: 'deterministic',
      matchConfidence: 1.0,
    }
  }

  // Stage 2: Fuzzy match
  const fuzzyMatches = await findFuzzyMatches(cleanName)
  if (fuzzyMatches.length > 0) {
    const best = fuzzyMatches[0]
    if (best) {
      if (best.similarityScore >= 0.85) {
        // High confidence — auto-accept
        await storeHighConfidenceMatch(cleanName, best, 'senator_profiles', 'person_name')
        return {
          entityId: best.entityId,
          matchMethod: 'fuzzy',
          matchConfidence: best.similarityScore,
        }
      }

      if (best.similarityScore >= 0.60) {
        // Medium confidence — AI verification
        try {
          const aiResult = await verifyMatchWithAI(
            cleanName,
            best.entityName,
            `Senator from ${senator.province || 'Canada'}, ${senator.groupAffiliation || 'Senate'} group`,
            'Politician entity in GovTrace database',
          )
          if (aiResult.verdict === 'match' && aiResult.confidence >= 0.7) {
            return {
              entityId: best.entityId,
              matchMethod: 'ai_verified',
              matchConfidence: aiResult.confidence,
            }
          }
        } catch (err) {
          console.warn(`  AI verification failed for ${cleanName}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  // Stage 3: No match — create new politician entity
  const newEntityId = await createNewEntity(cleanName, 'senator_profiles', 'person_name', 'politician')
  return {
    entityId: newEntityId,
    matchMethod: 'new_entity',
    matchConfidence: 0,
  }
}

/**
 * Sleep helper for courteous HTTP delays between requests.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs the complete Senate voting records ingestion pipeline.
 * Phase A: Vote listings → Phase B: Senator matching → Phase C: Ballots
 */
export async function runSenateIngestion(): Promise<void> {
  const db = getDb()

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'senate',
      status: 'running',
      sourceFileUrl: 'https://sencanada.ca/en/in-the-chamber/votes',
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id

  const stats = {
    votesIngested: 0,
    senatorsMatched: 0,
    ballotsIngested: 0,
    sessionsProcessed: 0,
    sessionsSkipped: 0,
  }

  // Collect senator records encountered during listing scrape
  // (populated in Phase C from ballot pages, used in Phase B)
  const senatorsBySenatorId = new Map<number, SenatorRecord>()

  try {
    // =========================================================
    // Phase A: Scrape vote listings for all sessions
    // =========================================================
    console.log('\n=== Phase A: Senate vote listings ===')
    for (const session of SENATE_SESSIONS) {
      try {
        console.log(`  Fetching vote listing for ${session.code}...`)
        const html = await fetchSenateVoteListingHtml(session.parliament, session.session)
        const votes = parseSenateVoteListingHtml(html, session.code)

        if (votes.length > 0) {
          const count = await upsertSenateVotes(votes, session.parliament, session.session, session.code)
          stats.votesIngested += count
          stats.sessionsProcessed++
          console.log(`    Upserted ${count} votes for ${session.code}`)
        } else {
          console.log(`    No votes found for ${session.code} (new session or parse failure)`)
        }

        // 200ms delay between session listing requests (Cloudflare mitigation)
        await sleep(200)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping vote listing for ${session.code}: ${msg}`)
        stats.sessionsSkipped++
      }
    }
    console.log(`Phase A complete: ${stats.votesIngested} votes across ${stats.sessionsProcessed} sessions`)

    // =========================================================
    // Phase C: Scrape vote detail pages for ballots (before Phase B)
    // We scrape detail pages first to discover senators, then match in Phase B.
    // =========================================================
    console.log('\n=== Phase C: Senate vote detail pages (ballot scraping) ===')

    // Get all senate votes where ballots haven't been ingested yet (resumable)
    const pendingVotes = await db
      .select({
        id: parliamentVotes.id,
        parlSessionCode: parliamentVotes.parlSessionCode,
        parliamentNumber: parliamentVotes.parliamentNumber,
        sessionNumber: parliamentVotes.sessionNumber,
        divisionNumber: parliamentVotes.divisionNumber,
      })
      .from(parliamentVotes)
      .where(sql`${parliamentVotes.chamber} = 'senate' AND ${parliamentVotes.ballotsIngested} = false`)
      .orderBy(parliamentVotes.parliamentNumber, parliamentVotes.sessionNumber, parliamentVotes.divisionNumber)

    console.log(`  ${pendingVotes.length} Senate votes need ballot ingestion`)

    let ballotCount = 0
    for (let i = 0; i < pendingVotes.length; i++) {
      const vote = pendingVotes[i]
      if (!vote) continue

      // Senate vote ID format: "senate-{parl}-{session}-{senateVoteId}"
      // The divisionNumber stores the original Senate voteId integer
      const senateVoteId = String(vote.divisionNumber)

      try {
        const html = await fetchSenateVoteDetailHtml(
          senateVoteId,
          vote.parliamentNumber,
          vote.sessionNumber,
        )
        const parsedBallots = parseSenateVoteDetailHtml(html)

        if (parsedBallots.length > 0) {
          // Collect senator records for Phase B matching
          for (const ballot of parsedBallots) {
            if (!senatorsBySenatorId.has(ballot.senatorId)) {
              senatorsBySenatorId.set(ballot.senatorId, {
                senatorId: ballot.senatorId,
                firstName: ballot.firstName,
                lastName: ballot.lastName,
                province: ballot.province,
                groupAffiliation: ballot.groupAffiliation,
              })
            }
          }

          // Build ballot records — use empty entityLookup for now (Phase B will update)
          const ballotRecords = buildSenateBallotRecords(
            parsedBallots,
            vote.id,
            vote.parliamentNumber,
            vote.sessionNumber,
            vote.divisionNumber,
          )

          const inserted = await upsertSenateBallots(ballotRecords, new Map())
          ballotCount += inserted
          stats.ballotsIngested += inserted
        }

        await markSenateBallotsIngested(vote.id)

        // Log progress every 50 divisions
        if ((i + 1) % 50 === 0) {
          console.log(`  Progress: ${i + 1}/${pendingVotes.length} votes (${ballotCount} ballots)`)
        }

        // 200ms delay between detail page requests (Cloudflare mitigation)
        await sleep(200)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping ballots for vote ${vote.id}: ${msg}`)
      }
    }
    console.log(`Phase C complete: ${stats.ballotsIngested} ballots ingested across ${pendingVotes.length} votes`)

    // =========================================================
    // Phase B: Senator entity matching via senatorId-anchored senator_profiles
    // Runs after Phase C to use senators discovered from ballot pages.
    // =========================================================
    console.log('\n=== Phase B: Senator entity matching ===')
    console.log(`  ${senatorsBySenatorId.size} unique senators discovered from ballot pages`)

    const entityLookup = new Map<number, string>()

    for (const senator of senatorsBySenatorId.values()) {
      try {
        // Check senator_profiles cache — if already matched, skip
        const existing = await db
          .select({ senatorId: senatorProfiles.senatorId, entityId: senatorProfiles.entityId })
          .from(senatorProfiles)
          .where(eq(senatorProfiles.senatorId, senator.senatorId))
          .limit(1)

        if (existing.length > 0 && existing[0]?.entityId) {
          entityLookup.set(senator.senatorId, existing[0].entityId)
          continue
        }

        // Run matching pipeline
        const { entityId, matchMethod, matchConfidence } = await matchSenatorToEntity(senator)

        // Upsert senator_profiles with senatorId as stable key
        const normalizedFullName = normalizeName(`${senator.firstName} ${senator.lastName}`)
        await db
          .insert(senatorProfiles)
          .values({
            senatorId: senator.senatorId,
            entityId,
            canonicalFirstName: senator.firstName,
            canonicalLastName: senator.lastName,
            normalizedName: normalizedFullName,
            province: senator.province || null,
            groupAffiliation: senator.groupAffiliation || null,
            matchMethod,
            matchConfidence,
          })
          .onConflictDoUpdate({
            target: senatorProfiles.senatorId,
            set: {
              entityId: sql`COALESCE(${senatorProfiles.entityId}, excluded.entity_id)`,
              matchMethod: sql`excluded.match_method`,
              matchConfidence: sql`excluded.match_confidence`,
              updatedAt: sql`NOW()`,
            },
          })

        entityLookup.set(senator.senatorId, entityId)
        stats.senatorsMatched++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping senator matching for ${senator.firstName} ${senator.lastName}: ${msg}`)
      }
    }
    console.log(`Phase B complete: ${stats.senatorsMatched} senators matched/upserted`)

    // Back-fill entityId on already-ingested ballots using the lookup built in Phase B
    if (entityLookup.size > 0) {
      console.log('  Back-filling entityId on senate ballots...')
      for (const [senatorId, entityId] of entityLookup) {
        await db
          .update(parliamentVoteBallots)
          .set({ entityId })
          .where(sql`${parliamentVoteBallots.chamber} = 'senate' AND ${parliamentVoteBallots.personId} = ${senatorId} AND ${parliamentVoteBallots.entityId} IS NULL`)
      }
      console.log('  Back-fill complete')
    }

    // =========================================================
    // Log ingestion run result
    // =========================================================
    await db.update(ingestionRuns).set({
      status: 'completed',
      recordsProcessed: stats.votesIngested,
      recordsInserted: stats.ballotsIngested,
      completedAt: new Date(),
      auditData: stats as unknown as Record<string, unknown>,
    }).where(sql`id = ${runId}`)

    console.log('\n=== Senate ingestion complete ===')
    console.log(`  Votes: ${stats.votesIngested}`)
    console.log(`  Senators matched: ${stats.senatorsMatched}`)
    console.log(`  Ballots: ${stats.ballotsIngested}`)
    console.log(`  Sessions processed: ${stats.sessionsProcessed}, skipped: ${stats.sessionsSkipped}`)
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
