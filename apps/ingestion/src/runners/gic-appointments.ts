/**
 * GIC Appointments ingestion pipeline
 *
 * Phases:
 *   A — Fetch org index (~290 OrgID codes from /orgs.php)
 *   B — For each org, fetch HTML profile, parse appointees, upsert to DB (200ms delay between orgs)
 *   C — Entity matching for non-vacant appointees via deterministic → fuzzy → AI pipeline
 */
import { sql, eq } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { gicAppointments } from '@govtrace/db/schema/appointments'
import { fetchOrganizationIndex, fetchOrganizationProfile } from '../downloaders/gic-appointments.ts'
import { parseOrganizationProfile } from '../parsers/gic-appointments.ts'
import { upsertGicAppointments } from '../upsert/gic-appointments.ts'
import { normalizeName } from '../normalizer/normalize.ts'
import { findDeterministicMatch, createNewEntity } from '../matcher/deterministic.ts'
import { findFuzzyMatches, storeHighConfidenceMatch } from '../matcher/fuzzy.ts'
import { verifyMatchWithAI } from '../matcher/ai-verify.ts'

/**
 * Courteous HTTP delay between profile page requests.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parses "LastName, FirstName" -> "FirstName LastName".
 * Returns input unchanged if no comma present.
 */
function parseCommaName(raw: string): string {
  const comma = raw.indexOf(',')
  if (comma === -1) return raw.trim()
  const last = raw.slice(0, comma).trim()
  const first = raw.slice(comma + 1).trim()
  if (!first) return last
  return `${first} ${last}`
}

/**
 * Match a single appointee to an entity via deterministic → fuzzy → AI → new entity pipeline.
 * Returns entityId (existing or newly created).
 */
async function matchAppointeeToEntity(
  rawName: string,
  organizationName: string,
  positionTitle: string,
): Promise<{ entityId: string; matchMethod: string; matchConfidence: number }> {
  const fullName = parseCommaName(rawName)
  const cleanName = normalizeName(fullName)

  // Stage 1: Deterministic match on normalized name
  const deterministicResult = await findDeterministicMatch(cleanName, 'gic_appointments', 'person_name')
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
        await storeHighConfidenceMatch(cleanName, best, 'gic_appointments', 'person_name')
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
            fullName,
            best.entityName,
            `GIC appointee to ${organizationName} as ${positionTitle}`,
            'Politician or public figure entity in GovTrace database',
          )
          if (aiResult.verdict === 'match' && aiResult.confidence >= 0.7) {
            return {
              entityId: best.entityId,
              matchMethod: 'ai_verified',
              matchConfidence: aiResult.confidence,
            }
          }
        } catch (err) {
          console.warn(`  AI verification failed for ${fullName}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  // Stage 3: No match — create new person entity
  const newEntityId = await createNewEntity(fullName, 'gic_appointments', 'person_name', 'person')
  return {
    entityId: newEntityId,
    matchMethod: 'new_entity',
    matchConfidence: 0,
  }
}

/**
 * Runs the complete GIC appointments ingestion pipeline.
 * Phase A: Org index → Phase B: Scrape profiles + upsert → Phase C: Entity matching
 */
export async function runGicAppointmentsIngestion(): Promise<void> {
  const db = getDb()

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'gic-appointments',
      status: 'running',
      sourceFileUrl: 'https://federal-organizations.canada.ca/orgs.php?lang=en&t=1',
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id

  const stats = {
    orgsProcessed: 0,
    orgsSkipped: 0,
    appointmentsUpserted: 0,
    appointeesMatched: 0,
    newEntitiesCreated: 0,
  }

  try {
    // =========================================================
    // Phase A: Fetch org index
    // =========================================================
    console.log('\n=== Phase A: Fetching organization index ===')
    const orgCodes = await fetchOrganizationIndex()
    console.log(`  Found ${orgCodes.length} organization codes`)

    // =========================================================
    // Phase B: Fetch each org profile and upsert
    // =========================================================
    console.log('\n=== Phase B: Scraping organization profiles ===')

    for (let i = 0; i < orgCodes.length; i++) {
      const orgCode = orgCodes[i]
      if (!orgCode) continue

      try {
        const html = await fetchOrganizationProfile(orgCode)
        const appointments = parseOrganizationProfile(html, orgCode)

        if (appointments.length > 0) {
          const count = await upsertGicAppointments(appointments)
          stats.appointmentsUpserted += count
        }

        stats.orgsProcessed++

        // Log progress every 25 orgs
        if ((i + 1) % 25 === 0) {
          console.log(
            `  Progress: ${i + 1}/${orgCodes.length} orgs | ${stats.appointmentsUpserted} appointments upserted`,
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping org ${orgCode}: ${msg}`)
        stats.orgsSkipped++
      }

      // Polite 200ms delay between requests
      if (i < orgCodes.length - 1) {
        await sleep(200)
      }
    }

    console.log(`Phase B complete: ${stats.appointmentsUpserted} appointments from ${stats.orgsProcessed} orgs (${stats.orgsSkipped} skipped)`)

    // =========================================================
    // Phase C: Entity matching for non-vacant appointees
    // =========================================================
    console.log('\n=== Phase C: Entity matching ===')

    // Fetch all unmatched, non-vacant appointees
    const unmatched = await db
      .select({
        id: gicAppointments.id,
        appointeeName: gicAppointments.appointeeName,
        organizationName: gicAppointments.organizationName,
        positionTitle: gicAppointments.positionTitle,
      })
      .from(gicAppointments)
      .where(
        sql`${gicAppointments.entityId} IS NULL AND ${gicAppointments.isVacant} = false`,
      )

    console.log(`  ${unmatched.length} unmatched non-vacant appointees to process`)

    for (let i = 0; i < unmatched.length; i++) {
      const row = unmatched[i]
      if (!row) continue

      try {
        const { entityId, matchMethod, matchConfidence } = await matchAppointeeToEntity(
          row.appointeeName,
          row.organizationName,
          row.positionTitle,
        )

        await db
          .update(gicAppointments)
          .set({ entityId, updatedAt: new Date() })
          .where(eq(gicAppointments.id, row.id))

        stats.appointeesMatched++
        if (matchMethod === 'new_entity') stats.newEntitiesCreated++

        // Log progress every 100 matched
        if ((i + 1) % 100 === 0) {
          console.log(`  Progress: ${i + 1}/${unmatched.length} matched (${stats.newEntitiesCreated} new entities)`)
        }
      } catch (err) {
        console.warn(
          `  Matching failed for ${row.appointeeName}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    console.log(`Phase C complete: ${stats.appointeesMatched} appointees matched, ${stats.newEntitiesCreated} new entities`)

    // =========================================================
    // Log ingestion run result
    // =========================================================
    await db.update(ingestionRuns).set({
      status: 'completed',
      recordsProcessed: stats.orgsProcessed,
      recordsInserted: stats.appointmentsUpserted,
      completedAt: new Date(),
      auditData: stats as unknown as Record<string, unknown>,
    }).where(sql`id = ${runId}`)

    console.log('\n=== GIC appointments ingestion complete ===')
    console.log(`  Orgs processed: ${stats.orgsProcessed} (${stats.orgsSkipped} skipped)`)
    console.log(`  Appointments upserted: ${stats.appointmentsUpserted}`)
    console.log(`  Appointees matched: ${stats.appointeesMatched}`)
    console.log(`  New entities created: ${stats.newEntitiesCreated}`)
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
