/**
 * Parliamentary voting records ingestion pipeline (PARL-01, PARL-05)
 *
 * Phases:
 *   A — Bills from LEGISinfo JSON (one request per session, ~16 total)
 *   B — Aggregate vote summaries from ourcommons.ca XML (one request per session)
 *   C — MP entity matching via PersonId-anchored mp_profiles
 *   D — Individual MP ballots (one request per division, 6,000–8,000 total with 100ms delay)
 *   E — Bill AI summaries via Claude Haiku (PARL-05)
 */
import { sql, eq, isNull } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { XMLParser } from 'fast-xml-parser'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { entities } from '@govtrace/db/schema/entities'
import {
  parliamentBills,
  parliamentVotes,
  parliamentVoteBallots,
  mpProfiles,
  billSummaries,
} from '@govtrace/db/schema/parliament'
import {
  PARLIAMENT_SESSIONS,
  fetchVotesXml,
  fetchBallotsXml,
  fetchMembersXml,
  fetchBillsJson,
} from '../downloaders/parliament.ts'
import { parseVotesXml } from '../parsers/parliament-votes.ts'
import { parseVoteBallotsXml } from '../parsers/parliament-ballots.ts'
import { parseBillsJson } from '../parsers/parliament-bills.ts'
import { upsertBills } from '../upsert/parliament-bills.ts'
import { upsertVotes, markBallotsIngested } from '../upsert/parliament-votes.ts'
import { upsertBallots } from '../upsert/parliament-ballots.ts'
import { normalizeName } from '../normalizer/normalize.ts'
import { findDeterministicMatch, createNewEntity } from '../matcher/deterministic.ts'
import { findFuzzyMatches, storeHighConfidenceMatch } from '../matcher/fuzzy.ts'
import { verifyMatchWithAI } from '../matcher/ai-verify.ts'

const HAIKU_MODEL = 'claude-haiku-3-5'

// Parser for Members of Parliament XML (same structure as VoteParticipant XML)
const membersParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['MemberOfParliament'].includes(name),
  parseAttributeValue: false,
  trimValues: true,
})

interface MpRecord {
  personId: number
  firstName: string
  lastName: string
  constituency: string | null
  province: string | null
  caucusShortName: string | null
}

function parseMembersXml(xml: string): MpRecord[] {
  if (!xml || xml.trim().length === 0) return []

  let parsed: unknown
  try {
    parsed = membersParser.parse(xml)
  } catch {
    return []
  }

  if (typeof parsed !== 'object' || parsed === null) return []

  const root = (parsed as Record<string, unknown>)['ArrayOfMemberOfParliament']
  if (typeof root !== 'object' || root === null) return []

  const members = (root as Record<string, unknown>)['MemberOfParliament']
  if (!Array.isArray(members)) return []

  return members.map((m: unknown): MpRecord => {
    const member = m as Record<string, unknown>
    return {
      personId: Number(member['PersonId'] ?? 0),
      firstName: String(member['PersonOfficialFirstName'] ?? '').trim(),
      lastName: String(member['PersonOfficialLastName'] ?? '').trim(),
      constituency: String(member['ConstituencyName'] ?? '').trim() || null,
      province: String(member['ConstituencyProvinceTerritoryName'] ?? '').trim() || null,
      caucusShortName: String(member['CaucusShortName'] ?? '').trim() || null,
    }
  })
}

/**
 * Strips common honorific prefixes from MP names before matching.
 * Canadian MPs often have "Hon.", "Right Hon.", "Mr.", "Ms.", "Dr." etc.
 */
function stripHonorifics(name: string): string {
  return name
    .replace(/^(Right Hon\.|Right Honourable|Hon\.|Honourable|Mr\.|Mrs\.|Ms\.|Miss|Dr\.|Prof\.)\s+/i, '')
    .trim()
}

/**
 * Match a single MP to an entity via deterministic → fuzzy → AI fallback.
 * Returns entityId (existing or newly created).
 */
async function matchMpToEntity(mp: MpRecord): Promise<{
  entityId: string
  matchMethod: string
  matchConfidence: number
}> {
  const fullName = `${mp.firstName} ${mp.lastName}`.trim()
  const cleanName = stripHonorifics(fullName)

  // Stage 1: Deterministic match on normalized name
  const deterministicResult = await findDeterministicMatch(cleanName, 'mp_profiles', 'person_name')
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
    if (!best) {
      // No match — fall through to new entity
    } else if (best.similarityScore >= 0.85) {
      // High confidence — auto-accept
      await storeHighConfidenceMatch(cleanName, best, 'mp_profiles', 'person_name')
      return {
        entityId: best.entityId,
        matchMethod: 'fuzzy',
        matchConfidence: best.similarityScore,
      }
    } else if (best.similarityScore >= 0.60) {
      // Medium confidence — AI verification
      try {
        const aiResult = await verifyMatchWithAI(
          cleanName,
          best.entityName,
          `MP from ${mp.province ?? 'Canada'}, ${mp.caucusShortName ?? 'independent'} party, constituency: ${mp.constituency ?? 'unknown'}`,
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

  // Stage 3: No match — create new politician entity
  const newEntityId = await createNewEntity(cleanName, 'mp_profiles', 'person_name', 'politician')
  return {
    entityId: newEntityId,
    matchMethod: 'new_entity',
    matchConfidence: 0,
  }
}

/**
 * Sleep helper for courteous HTTP delays between ballot requests.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs the complete parliamentary voting records ingestion pipeline.
 * Phase A: Bills → Phase B: Votes → Phase C: MP matching → Phase D: Ballots → Phase E: Summaries
 */
export async function runParliamentIngestion(): Promise<void> {
  const db = getDb()

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'parliament',
      status: 'running',
      sourceFileUrl: 'https://www.ourcommons.ca/members/en/votes',
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id

  const stats = {
    billsIngested: 0,
    votesIngested: 0,
    mpsMatched: 0,
    ballotsIngested: 0,
    summariesGenerated: 0,
    sessionsProcessed: 0,
    sessionsSkipped: 0,
  }

  try {
    // =========================================================
    // Phase A: Bills from LEGISinfo JSON
    // =========================================================
    console.log('\n=== Phase A: Bills from LEGISinfo ===')
    for (const session of PARLIAMENT_SESSIONS) {
      try {
        console.log(`  Fetching bills for ${session.code}...`)
        const json = await fetchBillsJson(session.parliament, session.session)
        const bills = parseBillsJson(json, session.code)
        if (bills.length > 0) {
          const count = await upsertBills(bills)
          stats.billsIngested += count
          console.log(`    Upserted ${count} bills for ${session.code}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping bills for ${session.code}: ${msg}`)
        if (!session.confirmed) stats.sessionsSkipped++
      }
    }
    console.log(`Phase A complete: ${stats.billsIngested} bills`)

    // =========================================================
    // Phase B: Aggregate votes from ourcommons.ca XML
    // =========================================================
    console.log('\n=== Phase B: Aggregate votes ===')
    for (const session of PARLIAMENT_SESSIONS) {
      try {
        console.log(`  Fetching votes for ${session.code}...`)
        const xml = await fetchVotesXml(session.parliament, session.session)
        const votes = parseVotesXml(xml, session.code)
        if (votes.length > 0) {
          const sourceFileHash = `${session.code}-${Date.now()}`
          const count = await upsertVotes(votes, sourceFileHash)
          stats.votesIngested += count
          stats.sessionsProcessed++
          console.log(`    Upserted ${count} votes for ${session.code}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping votes for ${session.code}: ${msg}`)
        if (!session.confirmed) stats.sessionsSkipped++
      }
    }
    console.log(`Phase B complete: ${stats.votesIngested} votes`)

    // =========================================================
    // Phase C: MP entity matching via PersonId-anchored mp_profiles
    // Note: parliamentary MP matching uses PersonId-anchored mp_profiles instead
    // of the generic SOURCE_CONFIGS pipeline in run-matching.ts. PersonId is the
    // stable ground truth per person across sessions (Pitfall 3 — same name ≠ same MP).
    // =========================================================
    console.log('\n=== Phase C: MP entity matching ===')
    for (const session of PARLIAMENT_SESSIONS) {
      try {
        console.log(`  Fetching members for ${session.code}...`)
        const xml = await fetchMembersXml(session.parliament, session.session)
        const members = parseMembersXml(xml)

        for (const mp of members) {
          if (mp.personId === 0) continue

          // Check mp_profiles cache — if already matched, skip
          const existing = await db
            .select({ personId: mpProfiles.personId, entityId: mpProfiles.entityId })
            .from(mpProfiles)
            .where(eq(mpProfiles.personId, mp.personId))
            .limit(1)

          if (existing.length > 0) continue // Already matched from a previous session

          // Run matching pipeline
          const { entityId, matchMethod, matchConfidence } = await matchMpToEntity(mp)

          // Upsert mp_profiles with PersonId as stable key
          const normalizedFullName = normalizeName(`${mp.firstName} ${mp.lastName}`)
          await db
            .insert(mpProfiles)
            .values({
              personId: mp.personId,
              entityId,
              canonicalFirstName: mp.firstName,
              canonicalLastName: mp.lastName,
              normalizedName: normalizedFullName,
              matchMethod,
              matchConfidence,
            })
            .onConflictDoUpdate({
              target: mpProfiles.personId,
              set: {
                entityId: sql`COALESCE(${mpProfiles.entityId}, excluded.entity_id)`,
                matchMethod: sql`excluded.match_method`,
                matchConfidence: sql`excluded.match_confidence`,
                updatedAt: sql`NOW()`,
              },
            })

          stats.mpsMatched++
        }

        console.log(`    Matched ${members.length} MPs for ${session.code}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping member matching for ${session.code}: ${msg}`)
      }
    }
    console.log(`Phase C complete: ${stats.mpsMatched} MPs matched/upserted`)

    // =========================================================
    // Phase D: Individual MP ballots (resumable)
    // =========================================================
    console.log('\n=== Phase D: Individual MP ballots ===')

    // Build entityLookup Map<personId, entityId> from mp_profiles
    const profileRows = await db
      .select({ personId: mpProfiles.personId, entityId: mpProfiles.entityId })
      .from(mpProfiles)
      .where(sql`${mpProfiles.entityId} IS NOT NULL`)

    const entityLookup = new Map<number, string>()
    for (const row of profileRows) {
      if (row.entityId) entityLookup.set(row.personId, row.entityId)
    }
    console.log(`  Loaded ${entityLookup.size} PersonId→entityId mappings`)

    // Get all votes that haven't had their ballots ingested yet (resumable)
    const pendingVotes = await db
      .select({
        id: parliamentVotes.id,
        parliamentNumber: parliamentVotes.parliamentNumber,
        sessionNumber: parliamentVotes.sessionNumber,
        divisionNumber: parliamentVotes.divisionNumber,
      })
      .from(parliamentVotes)
      .where(eq(parliamentVotes.ballotsIngested, false))
      .orderBy(parliamentVotes.parliamentNumber, parliamentVotes.sessionNumber, parliamentVotes.divisionNumber)

    console.log(`  ${pendingVotes.length} divisions need ballot ingestion`)

    let ballotCount = 0
    for (let i = 0; i < pendingVotes.length; i++) {
      const vote = pendingVotes[i]
      if (!vote) continue

      try {
        const xml = await fetchBallotsXml(vote.parliamentNumber, vote.sessionNumber, vote.divisionNumber)
        const ballots = parseVoteBallotsXml(xml, vote.id)

        if (ballots.length > 0) {
          const inserted = await upsertBallots(ballots, entityLookup)
          ballotCount += inserted
          stats.ballotsIngested += inserted
        }

        await markBallotsIngested(vote.id)

        // Log progress every 100 divisions
        if ((i + 1) % 100 === 0) {
          console.log(`  Progress: ${i + 1}/${pendingVotes.length} divisions (${ballotCount} ballots)`)
        }

        // Courteous 100ms delay between requests (Pitfall 2)
        await sleep(100)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping ballots for vote ${vote.id}: ${msg}`)
      }
    }
    console.log(`Phase D complete: ${stats.ballotsIngested} ballots ingested across ${pendingVotes.length} divisions`)

    // =========================================================
    // Phase E: Bill summaries via Claude Haiku (PARL-05)
    // =========================================================
    console.log('\n=== Phase E: Bill AI summaries ===')

    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) {
      console.warn('  ANTHROPIC_API_KEY not set — skipping bill summary generation')
    } else {
      // Query bills that have no summary yet
      const billsWithoutSummary = await db
        .select({
          id: parliamentBills.id,
          billNumberFormatted: parliamentBills.billNumberFormatted,
          shortTitleEn: parliamentBills.shortTitleEn,
          longTitleEn: parliamentBills.longTitleEn,
          billTypeEn: parliamentBills.billTypeEn,
          currentStatusEn: parliamentBills.currentStatusEn,
          sponsorEn: parliamentBills.sponsorEn,
        })
        .from(parliamentBills)
        .where(
          sql`${parliamentBills.id} NOT IN (SELECT bill_id FROM bill_summaries WHERE is_stale = false)`,
        )

      const SUMMARY_COST_LIMIT = 5000
      if (billsWithoutSummary.length > SUMMARY_COST_LIMIT) {
        console.warn(
          `  WARNING: ${billsWithoutSummary.length} bills need summaries (>${SUMMARY_COST_LIMIT} limit). ` +
          `Processing first ${SUMMARY_COST_LIMIT} — re-run to process remainder. Estimated cost: ~$${(billsWithoutSummary.length * 0.0003).toFixed(2)} total.`,
        )
      }

      const billsToSummarize = billsWithoutSummary.slice(0, SUMMARY_COST_LIMIT)
      console.log(`  Generating summaries for ${billsToSummarize.length} bills...`)

      const client = new Anthropic({ apiKey })
      const BATCH_SIZE = 50

      for (let i = 0; i < billsToSummarize.length; i += BATCH_SIZE) {
        const batch = billsToSummarize.slice(i, i + BATCH_SIZE)

        for (const bill of batch) {
          try {
            const prompt = `You are writing for a general audience — explain this Canadian federal bill in 2-3 sentences that a grandparent could understand. No legalese. Focus on what it actually does in practice.

Bill: ${bill.billNumberFormatted} — ${bill.shortTitleEn ?? '(no short title)'}
Full title: ${bill.longTitleEn ?? '(no long title)'}
Type: ${bill.billTypeEn ?? 'Unknown'}
Status: ${bill.currentStatusEn ?? 'Unknown'}
Introduced by: ${bill.sponsorEn ?? 'Unknown'}

Respond with only the plain-language summary. No preamble, no "This bill..." prefix needed.`

            const response = await client.messages.create({
              model: HAIKU_MODEL,
              max_tokens: 256,
              messages: [{ role: 'user', content: prompt }],
            })

            const content = response.content[0]
            const summaryText =
              content?.type === 'text' ? content.text.trim() : ''

            if (summaryText) {
              await db
                .insert(billSummaries)
                .values({
                  billId: bill.id,
                  summaryText,
                  model: HAIKU_MODEL,
                  isStale: false,
                })
                .onConflictDoUpdate({
                  target: billSummaries.billId,
                  set: {
                    summaryText: sql`excluded.summary_text`,
                    model: sql`excluded.model`,
                    isStale: false,
                    generatedAt: sql`NOW()`,
                  },
                })

              stats.summariesGenerated++
            }
          } catch (err) {
            console.warn(
              `  Failed to generate summary for ${bill.id}: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }

        // 200ms delay between batches to be respectful to Claude API
        if (i + BATCH_SIZE < billsToSummarize.length) {
          await sleep(200)
        }
      }
    }
    console.log(`Phase E complete: ${stats.summariesGenerated} summaries generated`)

    // =========================================================
    // Log ingestion run result
    // =========================================================
    await db.update(ingestionRuns).set({
      status: 'completed',
      recordsProcessed: stats.votesIngested + stats.billsIngested,
      recordsInserted: stats.ballotsIngested + stats.summariesGenerated,
      completedAt: new Date(),
      auditData: stats as unknown as Record<string, unknown>,
    }).where(sql`id = ${runId}`)

    console.log('\n=== Parliament ingestion complete ===')
    console.log(`  Bills: ${stats.billsIngested}`)
    console.log(`  Votes: ${stats.votesIngested}`)
    console.log(`  MPs matched: ${stats.mpsMatched}`)
    console.log(`  Ballots: ${stats.ballotsIngested}`)
    console.log(`  Bill summaries: ${stats.summariesGenerated}`)
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
