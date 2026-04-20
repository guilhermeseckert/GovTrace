/**
 * Flagged merge runner.
 *
 * 1. Snapshots high-cardinality duplicate groups (size ≥ 3) BEFORE invoking merge.
 * 2. Calls the existing unchanged `runCrossDatasetMerge()` which performs the merge.
 * 3. Writes audit rows into `entity_matches_log` with `is_flagged_for_review = true`
 *    and `flag_reason = 'initial_strip_high_cardinality_merge'` for every loser
 *    that was collapsed in a ≥ 3-entity group (per locked decision 4).
 * 4. Runs 4 smoke-check queries and prints a summary.
 *
 * Usage:
 *   node --import tsx/esm apps/ingestion/scripts/run-flagged-merge.ts
 *
 * Prerequisites — MUST be satisfied before running:
 *   1. renormalize-entities.ts has completed successfully in production
 *   2. preview-merge-groups.ts has been run and merge-proposal.json reviewed
 *      by a human, with results deemed acceptable (per locked decision 3)
 *
 * Safety:
 *   Writes to production. Invokes the existing unchanged cross-dataset merge
 *   (soft-deactivates losers) and inserts audit rows. Does NOT modify
 *   apps/ingestion/src/matcher/cross-dataset-merge.ts.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { runCrossDatasetMerge } from '../src/matcher/cross-dataset-merge.ts'

const FLAG_REASON = 'initial_strip_high_cardinality_merge'
const MATCH_METHOD = 'cross_dataset_merge_v3_initial_strip'
const BATCH_SIZE = 500

type HighCardGroupRow = {
  normalized_name: string
  ids: string
  group_size: number
  [key: string]: unknown
}

interface HighCardGroup {
  normalized_name: string
  winner_id: string
  loser_ids: string[]
  group_size: number
}

type NameRow = {
  id: string
  canonical_name: string
  [key: string]: unknown
}

type CountRow = {
  cnt: string
  [key: string]: unknown
}

function parsePgArray(raw: string): string[] {
  return raw
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.replace(/^"(.*)"$/, '$1'))
    .filter(Boolean)
}

async function snapshotHighCardGroups(): Promise<HighCardGroup[]> {
  const db = getDb()
  const rows = Array.from(
    await db.execute<HighCardGroupRow>(sql`
      SELECT normalized_name,
             array_agg(id::text ORDER BY created_at)::text AS ids,
             count(*)::int AS group_size
      FROM entities
      WHERE is_active = true
        AND normalized_name IS NOT NULL
        AND normalized_name != ''
      GROUP BY normalized_name
      HAVING count(*) >= 3
    `),
  )

  const groups: HighCardGroup[] = []
  for (const r of rows) {
    const ids = parsePgArray(r.ids)
    if (ids.length < 2) continue
    const winnerId = ids[0]
    if (!winnerId) continue
    groups.push({
      normalized_name: r.normalized_name,
      winner_id: winnerId,
      loser_ids: ids.slice(1),
      group_size: Number(r.group_size),
    })
  }
  return groups
}

async function fetchCanonicalNames(ids: string[]): Promise<Map<string, string>> {
  const db = getDb()
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  const CHUNK = 5000
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const rows = Array.from(
      await db.execute<NameRow>(sql`
        SELECT id::text AS id, canonical_name FROM entities WHERE id = ANY(${slice}::uuid[])
      `),
    )
    for (const r of rows) out.set(r.id, r.canonical_name)
  }
  return out
}

async function writeFlaggedAuditRows(groups: HighCardGroup[]): Promise<number> {
  const db = getDb()

  const allIds: string[] = []
  for (const g of groups) {
    allIds.push(g.winner_id, ...g.loser_ids)
  }
  const nameMap = await fetchCanonicalNames(allIds)

  // Flatten to one row per (winner, loser) pair
  interface AuditRow {
    winnerId: string
    loserId: string
    winnerName: string
    loserName: string
    normalizedName: string
  }
  const rows: AuditRow[] = []
  for (const g of groups) {
    const winnerName = nameMap.get(g.winner_id) ?? ''
    for (const loserId of g.loser_ids) {
      rows.push({
        winnerId: g.winner_id,
        loserId,
        winnerName,
        loserName: nameMap.get(loserId) ?? '',
        normalizedName: g.normalized_name,
      })
    }
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const winnerIds = batch.map((r) => r.winnerId)
    const loserIds = batch.map((r) => r.loserId)
    const winnerNames = batch.map((r) => r.winnerName)
    const loserNames = batch.map((r) => r.loserName)
    const normalizedNames = batch.map((r) => r.normalizedName)

    try {
      await db.execute(sql`
        INSERT INTO entity_matches_log (
          entity_a_id, entity_b_id,
          raw_name_a, raw_name_b,
          normalized_name_a, normalized_name_b,
          match_method,
          decision,
          is_flagged_for_review,
          flag_reason,
          resolved_at
        )
        SELECT
          w.id::uuid,
          l.id::uuid,
          wn.name,
          ln.name,
          nn.name,
          nn.name,
          ${MATCH_METHOD},
          'match',
          true,
          ${FLAG_REASON},
          NOW()
        FROM unnest(${winnerIds}::text[]) WITH ORDINALITY AS w(id, ord)
        JOIN unnest(${loserIds}::text[]) WITH ORDINALITY AS l(id, ord) ON w.ord = l.ord
        JOIN unnest(${winnerNames}::text[]) WITH ORDINALITY AS wn(name, ord) ON w.ord = wn.ord
        JOIN unnest(${loserNames}::text[]) WITH ORDINALITY AS ln(name, ord) ON w.ord = ln.ord
        JOIN unnest(${normalizedNames}::text[]) WITH ORDINALITY AS nn(name, ord) ON w.ord = nn.ord
      `)
      inserted += batch.length
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[audit] batch ${Math.floor(i / BATCH_SIZE) + 1} insert failed: ${msg}`,
      )
    }
  }

  return inserted
}

async function runSmokeChecks(): Promise<void> {
  const db = getDb()

  const trudeauCountRow = Array.from(
    await db.execute<CountRow>(sql`
      SELECT count(*)::text AS cnt
      FROM entities
      WHERE normalized_name = 'justin trudeau' AND is_active = true
    `),
  )[0]
  const trudeauCount = Number(trudeauCountRow?.cnt ?? 0)

  const inactiveRow = Array.from(
    await db.execute<CountRow>(sql`
      SELECT count(*)::text AS cnt FROM entities WHERE is_active = false
    `),
  )[0]
  const inactiveCount = Number(inactiveRow?.cnt ?? 0)

  const flagRow = Array.from(
    await db.execute<CountRow>(sql`
      SELECT count(*)::text AS cnt
      FROM entity_matches_log
      WHERE flag_reason = ${FLAG_REASON}
    `),
  )[0]
  const flagCount = Number(flagRow?.cnt ?? 0)

  type TrudeauRefRow = {
    id: string
    canonical_name: string
    donations: string
    ballots: string
    [key: string]: unknown
  }
  const trudeauRefs = Array.from(
    await db.execute<TrudeauRefRow>(sql`
      SELECT e.id::text AS id,
             e.canonical_name,
             (SELECT count(*) FROM donations WHERE entity_id = e.id)::text AS donations,
             (SELECT count(*) FROM parliament_vote_ballots WHERE entity_id = e.id)::text AS ballots
      FROM entities e
      WHERE e.normalized_name = 'justin trudeau' AND e.is_active = true
    `),
  )

  console.log('\n=== Post-merge smoke checks ===')
  console.log(`Justin Trudeau active entities:   ${trudeauCount}`)
  console.log(`Inactive entities total:          ${inactiveCount.toLocaleString()}`)
  console.log(`Flag rows (${FLAG_REASON}): ${flagCount.toLocaleString()}`)
  if (trudeauRefs.length > 0) {
    for (const t of trudeauRefs) {
      console.log(
        `  Trudeau ${t.canonical_name}: donations=${Number(t.donations).toLocaleString()}, ballots=${Number(t.ballots).toLocaleString()}`,
      )
    }
  } else {
    console.log('  (no active Justin Trudeau entity found — investigate if expected)')
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  console.log('=== Flagged merge runner ===')
  console.log('Step 1: snapshotting high-cardinality groups (size ≥ 3)...')
  const groups = await snapshotHighCardGroups()
  const loserCount = groups.reduce((acc, g) => acc + g.loser_ids.length, 0)
  console.log(
    `  ${groups.length.toLocaleString()} high-cardinality groups will be flagged post-merge (${loserCount.toLocaleString()} loser entities)`,
  )

  console.log('\nStep 2: invoking runCrossDatasetMerge()...')
  const stats = await runCrossDatasetMerge()
  console.log(
    `  Merge stats: duplicateGroups=${stats.duplicateGroups}, entitiesMerged=${stats.entitiesMerged}, refsUpdated=${stats.refsUpdated}`,
  )

  console.log('\nStep 3: writing audit flag rows to entity_matches_log...')
  const inserted = await writeFlaggedAuditRows(groups)
  console.log(`  ${inserted.toLocaleString()} audit rows written`)

  console.log('\nStep 4: smoke checks...')
  await runSmokeChecks()

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('\n=== Flagged merge complete ===')
  console.log(`Pre-merge high-card groups:     ${groups.length.toLocaleString()}`)
  console.log(`Merge duplicateGroups:          ${stats.duplicateGroups.toLocaleString()}`)
  console.log(`Merge entitiesMerged:           ${stats.entitiesMerged.toLocaleString()}`)
  console.log(`Merge refsUpdated:              ${stats.refsUpdated.toLocaleString()}`)
  console.log(`Audit rows inserted:            ${inserted.toLocaleString()}`)
  console.log(`Duration:                       ${duration}s`)
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
