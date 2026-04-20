/**
 * Dry-run merge preview.
 *
 * Groups entities by `normalized_name` (after V3 normalization) and reports
 * what `runCrossDatasetMerge()` would collapse — WITHOUT touching any entity
 * tables. Writes a JSON report plus a stdout summary for human review.
 *
 * Usage:
 *   node --import tsx/esm apps/ingestion/scripts/preview-merge-groups.ts
 *
 * Prerequisites:
 *   - renormalize-entities.ts already executed
 *
 * Safety:
 *   Read-only. Pure SELECT queries plus one JSON writeFile. No write statements
 *   anywhere in this script. Safe to run repeatedly.
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

const REPORT_PATH = join(
  process.cwd(),
  '.planning',
  'quick',
  '260419-sxc-fix-entity-name-normalizer-strip-honorif',
  'merge-proposal.json',
)

type GroupRow = {
  normalized_name: string
  group_size: number
  ids: string
  names: string
  types: string
  [key: string]: unknown
}

type RefCountRow = {
  id: string
  ref_count: string
  [key: string]: unknown
}

interface WinnerInfo {
  id: string
  canonical_name: string
  entity_type: string
}

interface LoserInfo {
  id: string
  canonical_name: string
  entity_type: string
  ref_count: number
}

interface ProposedGroup {
  normalized_name: string
  group_size: number
  winner: WinnerInfo
  losers: LoserInfo[]
}

interface MergeProposal {
  generated_at: string
  total_groups: number
  total_entities_to_deactivate: number
  groups_of_size_3_plus: number
  groups_of_size_10_plus: number
  top_50: ProposedGroup[]
  size_histogram: Record<string, number>
}

function parsePgArray(raw: string): string[] {
  // Trim surrounding braces and split on commas — safe for uuid / enum / identifier fields
  // that never contain commas. Embedded quotes would need smarter parsing; we expect none here.
  return raw
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.replace(/^"(.*)"$/, '$1'))
    .filter(Boolean)
}

async function main(): Promise<void> {
  const db = getDb()
  const startedAt = Date.now()
  console.log('=== Dry-run merge preview ===')
  console.log('Reading duplicate groups from entities...')

  const groupRows = Array.from(
    await db.execute<GroupRow>(sql`
      WITH preview AS (
        SELECT normalized_name,
               array_agg(id::text ORDER BY created_at) AS ids,
               array_agg(canonical_name ORDER BY created_at) AS names,
               array_agg(entity_type ORDER BY created_at) AS types,
               count(*)::int AS group_size
        FROM entities
        WHERE is_active = true
          AND normalized_name IS NOT NULL
          AND normalized_name != ''
        GROUP BY normalized_name
        HAVING count(*) > 1
      )
      SELECT normalized_name, group_size, ids::text AS ids, names::text AS names, types::text AS types
      FROM preview
      ORDER BY group_size DESC
    `),
  )

  console.log(`  ${groupRows.length.toLocaleString()} duplicate groups found`)

  // Build parsed structures for every group (we need winner+losers regardless of top-50)
  const parsed = groupRows.map((g) => {
    const ids = parsePgArray(g.ids)
    const names = parsePgArray(g.names)
    const types = parsePgArray(g.types)
    return {
      normalized_name: g.normalized_name,
      group_size: Number(g.group_size),
      ids,
      names,
      types,
    }
  })

  // Collect ALL loser ids across ALL groups in a single ANY() query for ref counts
  const allLoserIds: string[] = []
  for (const g of parsed) {
    for (let i = 1; i < g.ids.length; i++) {
      const id = g.ids[i]
      if (id) allLoserIds.push(id)
    }
  }
  console.log(
    `  ${allLoserIds.length.toLocaleString()} proposed loser entities — fetching reference counts...`,
  )

  const refCountMap = new Map<string, number>()
  if (allLoserIds.length > 0) {
    // Chunk to avoid overflowing the uuid[] parameter — 5K per query is fine
    const CHUNK = 5000
    for (let i = 0; i < allLoserIds.length; i += CHUNK) {
      const slice = allLoserIds.slice(i, i + CHUNK)
      const rows = Array.from(
        await db.execute<RefCountRow>(sql`
          SELECT e.id::text AS id,
                 (
                   (SELECT count(*) FROM donations WHERE entity_id = e.id) +
                   (SELECT count(*) FROM contracts WHERE entity_id = e.id) +
                   (SELECT count(*) FROM grants WHERE entity_id = e.id)
                 )::text AS ref_count
          FROM entities e
          WHERE e.id = ANY(${slice}::uuid[])
        `),
      )
      for (const r of rows) refCountMap.set(r.id, Number(r.ref_count))
    }
  }

  // Compose top-50 with winner+losers detail
  const topSlice = parsed.slice(0, 50)
  const top50: ProposedGroup[] = topSlice.map((g) => {
    const winnerId = g.ids[0] ?? ''
    const winnerName = g.names[0] ?? ''
    const winnerType = g.types[0] ?? ''
    const losers: LoserInfo[] = []
    for (let i = 1; i < g.ids.length; i++) {
      const id = g.ids[i]
      const canonical = g.names[i] ?? ''
      const entityType = g.types[i] ?? ''
      if (!id) continue
      losers.push({
        id,
        canonical_name: canonical,
        entity_type: entityType,
        ref_count: refCountMap.get(id) ?? 0,
      })
    }
    return {
      normalized_name: g.normalized_name,
      group_size: g.group_size,
      winner: { id: winnerId, canonical_name: winnerName, entity_type: winnerType },
      losers,
    }
  })

  // Aggregates
  let totalEntitiesToDeactivate = 0
  let groupsOfSize3Plus = 0
  let groupsOfSize10Plus = 0
  const sizeHistogram: Record<string, number> = {}
  for (const g of parsed) {
    totalEntitiesToDeactivate += g.group_size - 1
    if (g.group_size >= 3) groupsOfSize3Plus++
    if (g.group_size >= 10) groupsOfSize10Plus++
    const key = String(g.group_size)
    sizeHistogram[key] = (sizeHistogram[key] ?? 0) + 1
  }

  const report: MergeProposal = {
    generated_at: new Date().toISOString(),
    total_groups: parsed.length,
    total_entities_to_deactivate: totalEntitiesToDeactivate,
    groups_of_size_3_plus: groupsOfSize3Plus,
    groups_of_size_10_plus: groupsOfSize10Plus,
    top_50: top50,
    size_histogram: sizeHistogram,
  }

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1)

  console.log('\n=== Dry-run merge preview ===')
  console.log(`Total duplicate groups:        ${parsed.length.toLocaleString()}`)
  console.log(`Entities to deactivate:        ${totalEntitiesToDeactivate.toLocaleString()}`)
  console.log(
    `Groups with ≥ 3 collapse:      ${groupsOfSize3Plus.toLocaleString()}  (will be flagged)`,
  )
  console.log(
    `Groups with ≥ 10 collapse:     ${groupsOfSize10Plus.toLocaleString()}  (review first)`,
  )
  const largestGroup = parsed[0]
  if (largestGroup) {
    console.log(
      `Largest group:                 ${largestGroup.group_size}  ("${largestGroup.normalized_name}")`,
    )
  }

  console.log('\nTop 10 groups by size:')
  const top10 = parsed.slice(0, 10)
  for (const g of top10) {
    const winnerName = g.names[0] ?? '(unknown)'
    const winnerType = g.types[0] ?? '?'
    console.log(
      `  ${String(g.group_size).padStart(3)}  "${g.normalized_name}"  winner: ${winnerName} (${winnerType})`,
    )
  }

  console.log(`\nReport written: ${REPORT_PATH}`)
  console.log(`Duration:       ${duration}s`)
  console.log(
    '\nNext step: review merge-proposal.json. If acceptable, run scripts/run-flagged-merge.ts.',
  )
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
