import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { sql, eq, count, or } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entities } from '@govtrace/db/schema/entities'
import { donations, contracts, grants, internationalAid, lobbyRegistrations } from '@govtrace/db/schema/raw'
import { parliamentVoteBallots } from '@govtrace/db/schema/parliament'

const SearchInputSchema = z.object({
  query: z.string().max(200).default(''),
  type: z
    .enum(['all', 'politician', 'company', 'person', 'organization', 'department'])
    .default('all'),
  province: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
})

const AutocompleteInputSchema = z.object({
  query: z.string().min(1).max(200),
})

async function getEntityCounts(
  db: ReturnType<typeof getDb>,
  entityIds: string[],
): Promise<Record<string, { donations: number; contracts: number; grants: number; lobbying: number; aid: number; votes: number }>> {
  if (entityIds.length === 0) return {}

  const results: Record<
    string,
    { donations: number; contracts: number; grants: number; lobbying: number; aid: number; votes: number }
  > = {}

  // Batch-fetch entity info to determine politician vs person/org
  const entityInfo = await db.select({ id: entities.id, canonicalName: entities.canonicalName, entityType: entities.entityType })
    .from(entities).where(sql`id = ANY(ARRAY[${sql.join(entityIds.map(id => sql`${id}::uuid`), sql`, `)}])`)

  const entityMap = new Map(entityInfo.map(e => [e.id, e]))

  for (const id of entityIds) {
    const entity = entityMap.get(id)
    const isPolitician = entity?.entityType === 'politician'

    // Politicians: count donations received (by recipient_name), not made
    const donationWhere = isPolitician && entity?.canonicalName
      ? eq(donations.recipientName, entity.canonicalName)
      : eq(donations.entityId, id)

    const [donCount, conCount, grCount, lobCount, aidCount, voteCount] = await Promise.all([
      db.select({ c: count() }).from(donations).where(donationWhere),
      db.select({ c: count() }).from(contracts).where(eq(contracts.entityId, id)),
      db.select({ c: count() }).from(grants).where(eq(grants.entityId, id)),
      db
        .select({ c: count() })
        .from(lobbyRegistrations)
        .where(
          or(
            eq(lobbyRegistrations.lobbyistEntityId, id),
            eq(lobbyRegistrations.clientEntityId, id),
          ),
        ),
      db.select({ c: count() }).from(internationalAid).where(eq(internationalAid.entityId, id)),
      db.select({ c: count() }).from(parliamentVoteBallots).where(eq(parliamentVoteBallots.entityId, id)),
    ])
    results[id] = {
      donations: Number(donCount[0]?.c ?? 0),
      contracts: Number(conCount[0]?.c ?? 0),
      grants: Number(grCount[0]?.c ?? 0),
      lobbying: Number(lobCount[0]?.c ?? 0),
      aid: Number(aidCount[0]?.c ?? 0),
      votes: Number(voteCount[0]?.c ?? 0),
    }
  }
  return results
}

export const searchEntities = createServerFn({ method: 'GET' })
  .inputValidator(SearchInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const normalizedQuery = data.query.toLowerCase().trim()

    const typeFilter =
      data.type !== 'all' ? sql`AND entity_type = ${data.type}` : sql``
    const provinceFilter = data.province
      ? sql`AND province = ${data.province}`
      : sql``
    const dateFromFilter = data.dateFrom
      ? sql`AND created_at >= ${data.dateFrom}::date`
      : sql``
    const dateToFilter = data.dateTo
      ? sql`AND created_at <= ${data.dateTo}::date`
      : sql``

    let results: Array<{
      id: string
      canonical_name: string
      entity_type: string
      province: string | null
      score: number
    }>

    if (normalizedQuery.length >= 2) {
      // Search mode: pg_trgm similarity with ILIKE fallback.
      // Single-token queries like "trudeau" against "justin trudeau" can fall
      // below the default pg_trgm.similarity_threshold (0.3), so widen the
      // predicate with a substring match to guarantee recall for politicians
      // and other multi-word entities.
      const likePattern = `%${normalizedQuery}%`
      const rows = await db.execute<{
        id: string
        canonical_name: string
        entity_type: string
        province: string | null
        score: number
      }>(sql`
        SELECT id, canonical_name, entity_type, province,
               similarity(normalized_name, ${normalizedQuery}) AS score
        FROM entities
        WHERE (normalized_name % ${normalizedQuery} OR normalized_name ILIKE ${likePattern})
          AND is_active = true
          ${typeFilter}
          ${provinceFilter}
          ${dateFromFilter}
          ${dateToFilter}
        ORDER BY score DESC
        LIMIT ${data.pageSize}
        OFFSET ${(data.page - 1) * data.pageSize}
      `)
      results = Array.from(rows)
    } else {
      // Browse mode: show entities sorted by canonical_name
      const rows = await db.execute<{
        id: string
        canonical_name: string
        entity_type: string
        province: string | null
        score: number
      }>(sql`
        SELECT id, canonical_name, entity_type, province, 1.0 AS score
        FROM entities
        WHERE is_active = true
          ${typeFilter}
          ${provinceFilter}
          ${dateFromFilter}
          ${dateToFilter}
        ORDER BY canonical_name ASC
        LIMIT ${data.pageSize}
        OFFSET ${(data.page - 1) * data.pageSize}
      `)
      results = Array.from(rows)
    }

    const entityIds = results.map((r) => r.id)
    const counts = await getEntityCounts(db, entityIds)

    return {
      results: results.map((r) => ({
        id: r.id,
        canonicalName: r.canonical_name,
        entityType: r.entity_type,
        province: r.province,
        score: r.score,
        counts: counts[r.id] ?? { donations: 0, contracts: 0, grants: 0, lobbying: 0, aid: 0, votes: 0 },
      })),
      page: data.page,
      pageSize: data.pageSize,
    }
  })

export const getAutocomplete = createServerFn({ method: 'GET' })
  .inputValidator(AutocompleteInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const normalizedQuery = data.query.toLowerCase().trim()

    const results = await db.execute<{
      id: string
      canonical_name: string
      entity_type: string
      score: number
    }>(sql`
      SELECT id, canonical_name, entity_type,
             similarity(normalized_name, ${normalizedQuery}) AS score
      FROM entities
      WHERE normalized_name % ${normalizedQuery}
        AND is_active = true
      ORDER BY score DESC
      LIMIT 8
    `)

    const rows = results as unknown as Array<{
      id: string
      canonical_name: string
      entity_type: string
      score: number
    }>
    return rows.map((r) => ({
      id: r.id,
      canonicalName: r.canonical_name,
      entityType: r.entity_type,
    }))
  })
