/**
 * One-shot re-normalize script.
 *
 * Recomputes `normalized_name` for every row in the `entities` table and every
 * `normalized_*` column on the 10 raw source tables using the V3 `normalizeName`
 * pipeline. Writes are guarded by `IS DISTINCT FROM` so re-running produces zero
 * updates (idempotent).
 *
 * Usage (production):
 *   node --import tsx/esm apps/ingestion/scripts/renormalize-entities.ts
 *
 * Prerequisites:
 *   - V3 normalizer deployed (see apps/ingestion/src/normalizer/normalize.ts)
 *   - Database write access
 *
 * Safety:
 *   - Script takes NO arguments. Running it writes to production unconditionally.
 *   - Running twice is SAFE. The IS DISTINCT FROM guard skips no-op writes,
 *     so the second run should report ~0 updates (small clock-skew delta OK).
 *   - Per-batch try/catch keeps progress if a single batch fails; errors logged.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { normalizeName } from '../src/normalizer/normalize.ts'

const BATCH_SIZE = 500

// Duplicated from apps/ingestion/src/matcher/run-matching.ts:23-34.
// Kept inline here because this is a standalone script — avoids pulling in
// the matcher's full dependency graph for a simple UPDATE loop.
interface SourceConfig {
  table: string
  nameField: string
  normalizedField: string
}

const SOURCE_CONFIGS: SourceConfig[] = [
  { table: 'donations', nameField: 'contributor_name', normalizedField: 'normalized_contributor_name' },
  { table: 'contracts', nameField: 'vendor_name', normalizedField: 'normalized_vendor_name' },
  { table: 'grants', nameField: 'recipient_name', normalizedField: 'normalized_recipient_name' },
  { table: 'lobby_registrations', nameField: 'lobbyist_name', normalizedField: 'normalized_lobbyist_name' },
  { table: 'lobby_registrations', nameField: 'client_name', normalizedField: 'normalized_client_name' },
  { table: 'lobby_communications', nameField: 'lobbyist_name', normalizedField: 'normalized_lobbyist_name' },
  { table: 'lobby_communications', nameField: 'public_official_name', normalizedField: 'normalized_official_name' },
  { table: 'international_aid', nameField: 'implementer_name', normalizedField: 'normalized_implementer_name' },
  { table: 'travel_disclosures', nameField: 'name', normalizedField: 'normalized_name' },
  { table: 'hospitality_disclosures', nameField: 'name', normalizedField: 'normalized_name' },
]

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

async function renormalizeEntities(): Promise<{ total: number; updated: number }> {
  const db = getDb()
  console.log('\n[entities] loading rows...')
  const rows = Array.from(
    await db.execute<{ id: string; canonical_name: string }>(sql`
      SELECT id::text AS id, canonical_name FROM entities WHERE is_active = true
    `),
  )
  console.log(`[entities] ${rows.length.toLocaleString()} active rows loaded`)

  const work: { id: string; nv: string }[] = []
  for (const r of rows) {
    const nv = normalizeName(r.canonical_name)
    if (nv.length > 0) work.push({ id: r.id, nv })
  }
  console.log(`[entities] ${work.length.toLocaleString()} candidates after normalization`)

  let updated = 0
  const batches = chunk(work, BATCH_SIZE)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    if (!batch) continue
    const ids = batch.map((b) => b.id)
    const vals = batch.map((b) => b.nv)
    try {
      const result = await db.execute(sql`
        UPDATE entities AS e
        SET normalized_name = v.nv, updated_at = NOW()
        FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${vals}::text[]) AS nv) AS v
        WHERE e.id = v.id AND e.normalized_name IS DISTINCT FROM v.nv
      `)
      const count = (result as unknown as { count?: number }).count ?? 0
      updated += Number(count)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[entities] batch ${i + 1}/${batches.length} failed: ${msg}`)
    }

    const processed = (i + 1) * BATCH_SIZE
    if (processed % 10_000 === 0 || i === batches.length - 1) {
      console.log(
        `[entities] ${Math.min(processed, work.length).toLocaleString()}/${work.length.toLocaleString()} (${updated.toLocaleString()} updates so far)`,
      )
    }
  }

  return { total: work.length, updated }
}

async function renormalizeRawTable(
  config: SourceConfig,
): Promise<{ distinctNames: number; updates: number }> {
  const db = getDb()
  const label = `${config.table}.${config.normalizedField}`
  console.log(`\n[${label}] loading distinct names...`)

  const rows = Array.from(
    await db.execute<{ raw: string }>(sql`
      SELECT DISTINCT ${sql.raw(config.nameField)} AS raw
      FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.nameField)} IS NOT NULL
        AND ${sql.raw(config.nameField)} != ''
    `),
  )
  console.log(`[${label}] ${rows.length.toLocaleString()} distinct names`)

  const work: { raw: string; nv: string }[] = []
  for (const r of rows) {
    const nv = normalizeName(r.raw)
    if (nv.length > 0) work.push({ raw: r.raw, nv })
  }

  let updates = 0
  const batches = chunk(work, BATCH_SIZE)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    if (!batch) continue
    const rawNames = batch.map((b) => b.raw)
    const vals = batch.map((b) => b.nv)
    try {
      const result = await db.execute(sql`
        UPDATE ${sql.raw(config.table)} AS t
        SET ${sql.raw(config.normalizedField)} = v.nv
        FROM (SELECT unnest(${rawNames}::text[]) AS raw, unnest(${vals}::text[]) AS nv) AS v
        WHERE t.${sql.raw(config.nameField)} = v.raw
          AND t.${sql.raw(config.normalizedField)} IS DISTINCT FROM v.nv
      `)
      const count = (result as unknown as { count?: number }).count ?? 0
      updates += Number(count)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${label}] batch ${i + 1}/${batches.length} failed: ${msg}`)
    }

    if ((i + 1) % 50 === 0 || i === batches.length - 1) {
      console.log(
        `[${label}] batch ${i + 1}/${batches.length} — ${updates.toLocaleString()} updates so far`,
      )
    }
  }

  return { distinctNames: work.length, updates }
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  console.log('=== Re-normalize entities and raw-table normalized_* columns ===')
  console.log('V3 normalizer: honorific strip + aggressive middle-initial strip')

  const summary: Array<{ label: string; count: number; updates: number }> = []

  const ent = await renormalizeEntities()
  summary.push({ label: 'entities', count: ent.total, updates: ent.updated })

  for (const cfg of SOURCE_CONFIGS) {
    const r = await renormalizeRawTable(cfg)
    summary.push({
      label: `${cfg.table}.${cfg.normalizedField}`,
      count: r.distinctNames,
      updates: r.updates,
    })
  }

  const totalUpdates = summary.reduce((acc, s) => acc + s.updates, 0)
  const duration = ((Date.now() - startedAt) / 1000).toFixed(1)

  console.log('\n=== Re-normalize complete ===')
  for (const s of summary) {
    console.log(
      `  ${s.label.padEnd(48)} ${s.count.toLocaleString().padStart(12)} rows → ${s.updates.toLocaleString()} updates`,
    )
  }
  console.log(`\n  TOTAL UPDATES: ${totalUpdates.toLocaleString()}`)
  console.log(`  Duration:      ${duration}s`)
  console.log(
    '\nRe-run this script to verify idempotency — TOTAL UPDATES should be 0 on the second pass.',
  )
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
