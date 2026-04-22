/**
 * One-shot cleanup script for bilingual-column-artifact entities.
 *
 * Background:
 *   Some CSV sources (notably federal grants) have bilingual column headers
 *   like "batch report│rapport en lots" that bleed into data rows during
 *   parsing. The entity-matching pipeline previously minted entity rows for
 *   these strings, which then surface on the home page as fake top recipients
 *   (e.g. "batch report│rapport en lots — $25.1B").
 *
 *   This script deletes those entities and unlinks every FK reference to them
 *   from the raw source tables. The V3 normalizer now rejects these strings
 *   at ingestion time (see normalizer/normalize.ts BILINGUAL_ARTIFACT_RE), so
 *   re-ingestion will not recreate them.
 *
 * Safety:
 *   - Requires CONFIRM_CLEANUP=yes to perform writes. Without it, the script
 *     prints the match set and exits 0 (dry-run by default).
 *   - Runs each entity's cascade in a transaction: if any UPDATE/DELETE fails,
 *     the entire removal rolls back for that entity. Partial writes are
 *     impossible per entity.
 *   - Idempotent: safe to re-run. Second run will find zero artifact entities
 *     and exit with "0 cleaned".
 *
 * Usage (dry-run, default):
 *   node --import tsx/esm apps/ingestion/scripts/cleanup-bilingual-artifact-entities.ts
 *
 * Usage (production, writes enabled):
 *   ssh -i ~/.orbstack/ssh/id_ed25519 root@138.199.239.169 \
 *     "docker exec -e CONFIRM_CLEANUP=yes govtrace-ingestion-1 \
 *      node --import tsx/esm /app/scripts/cleanup-bilingual-artifact-entities.ts"
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

// Detection regex — matches only the clear CSV-header artifact "batch report /
// rapport en lots" in either order, separated by any of: whitespace, U+2502
// box-drawing, ASCII pipe, or forward slash.
//
// Earlier broader patterns (plain U+2502 or "report rapport") hit legitimate
// bilingual entity names (e.g. "VIA Rail Canada Inc.|VIA Rail Canada Inc.",
// "Sipekne'katik First Nation | Sipekne'katik First Nation", "Nova Scotia |
// Nouvelle-Écosse"). Narrowed to require BOTH anchor phrases.
const BILINGUAL_ARTIFACT_RE = /batch\s+report[\s│|/]*rapport\s+en\s+lots|rapport\s+en\s+lots[\s│|/]*batch\s+report/i

type ArtifactRow = { id: string; canonical_name: string }

type UnlinkPlan = { table: string; column: string }

// Tables that reference entities.id via a single FK column.
const SINGLE_FK_TABLES: UnlinkPlan[] = [
  { table: 'contracts', column: 'entity_id' },
  { table: 'grants', column: 'entity_id' },
  { table: 'donations', column: 'entity_id' },
  { table: 'international_aid', column: 'entity_id' },
  { table: 'travel_disclosures', column: 'entity_id' },
  { table: 'hospitality_disclosures', column: 'entity_id' },
  { table: 'parliament_vote_ballots', column: 'entity_id' },
  { table: 'gic_appointments', column: 'entity_id' },
]

// Tables with multiple FK columns back to entities.id.
const MULTI_FK_TABLES: Array<{ table: string; columns: string[] }> = [
  { table: 'lobby_registrations', columns: ['lobbyist_entity_id', 'client_entity_id'] },
  { table: 'lobby_communications', columns: ['lobbyist_entity_id', 'official_entity_id'] },
]

async function findArtifactEntities(): Promise<ArtifactRow[]> {
  const db = getDb()
  // Postgres ~ operator does not understand JavaScript regex — use POSIX
  // character class pattern that covers the same strings as the JS regex.
  const rows = await db.execute<ArtifactRow>(sql`
    SELECT id::text AS id, canonical_name
    FROM entities
    WHERE canonical_name ~* 'batch\\s+report.*rapport\\s+en\\s+lots'
       OR canonical_name ~* 'rapport\\s+en\\s+lots.*batch\\s+report'
  `)

  // Belt + suspenders: re-validate against the JS regex so the set never
  // contains something the ingestion-time guard would have allowed through.
  return Array.from(rows).filter((r) => BILINGUAL_ARTIFACT_RE.test(r.canonical_name))
}

async function cleanupEntity(entityId: string): Promise<number> {
  const db = getDb()
  let rowsUnlinked = 0

  await db.transaction(async (tx) => {
    for (const plan of SINGLE_FK_TABLES) {
      const result = await tx.execute(sql`
        UPDATE ${sql.raw(plan.table)}
        SET ${sql.raw(plan.column)} = NULL
        WHERE ${sql.raw(plan.column)} = ${entityId}::uuid
      `)
      rowsUnlinked += Number((result as unknown as { count?: number }).count ?? 0)
    }

    for (const plan of MULTI_FK_TABLES) {
      for (const col of plan.columns) {
        const result = await tx.execute(sql`
          UPDATE ${sql.raw(plan.table)}
          SET ${sql.raw(col)} = NULL
          WHERE ${sql.raw(col)} = ${entityId}::uuid
        `)
        rowsUnlinked += Number((result as unknown as { count?: number }).count ?? 0)
      }
    }

    // entity_aliases has ON DELETE CASCADE — belt + suspenders explicit delete
    await tx.execute(sql`DELETE FROM entity_aliases WHERE entity_id = ${entityId}::uuid`)

    await tx.execute(sql`DELETE FROM entities WHERE id = ${entityId}::uuid`)
  })

  return rowsUnlinked
}

async function main(): Promise<void> {
  console.log('=== Bilingual-column-artifact entity cleanup ===\n')

  const artifacts = await findArtifactEntities()
  console.log(`Matched ${artifacts.length.toLocaleString()} candidate entities:`)
  for (const row of artifacts) {
    console.log(`  - ${row.id}  ${JSON.stringify(row.canonical_name)}`)
  }

  const confirm = process.env['CONFIRM_CLEANUP']
  if (confirm !== 'yes') {
    console.log(
      '\nDRY-RUN: CONFIRM_CLEANUP is not set to "yes" — no writes performed.',
    )
    console.log('Re-run with CONFIRM_CLEANUP=yes to delete these entities.\n')
    return
  }

  if (artifacts.length === 0) {
    console.log('\nNothing to clean. Exiting.')
    return
  }

  console.log('\nCONFIRM_CLEANUP=yes — performing cleanup...')

  let cleaned = 0
  let totalUnlinked = 0
  for (const row of artifacts) {
    try {
      const unlinked = await cleanupEntity(row.id)
      cleaned += 1
      totalUnlinked += unlinked
      console.log(
        `  ✓ ${row.id}  unlinked ${unlinked.toLocaleString()} rows`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${row.id}  FAILED: ${msg}`)
    }
  }

  console.log(
    `\n${cleaned.toLocaleString()} entities cleaned, ${totalUnlinked.toLocaleString()} rows unlinked across ${SINGLE_FK_TABLES.length + MULTI_FK_TABLES.length} tables.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
