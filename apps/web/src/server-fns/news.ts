import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { sql, count, desc, and, ilike, eq, isNotNull } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { pressReleases } from '@govtrace/db/schema/raw'


// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type MentionedEntityRow = {
  name: string
  type: string
  entityId?: string
  confidence: string
}

export type DollarAmountRow = {
  amount: string
  context: string
}

export type PressReleaseRow = {
  id: string
  title: string
  url: string
  publishedDate: string
  department: string
  contentType: string | null
  summary: string | null
  ministers: string[] | null
  keywords: string[] | null
  mentionedEntities: MentionedEntityRow[] | null
  dollarAmounts: DollarAmountRow[] | null
}

export type EntityCrossRef = {
  name: string
  type: string
  entityId: string
  connections: {
    donations: number
    lobbying: number
    contracts: number
    totalValue: number
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// getNews
// ──────────────────────────────────────────────────────────────────────────────

const GetNewsInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  department: z.string().optional(),
  contentType: z.string().optional(),
  search: z.string().optional(),
})

export const getNews = createServerFn({ method: 'GET' })
  .inputValidator(GetNewsInput)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    const conditions = []

    if (data.department) {
      conditions.push(eq(pressReleases.department, data.department))
    }

    if (data.contentType) {
      conditions.push(eq(pressReleases.contentType, data.contentType))
    }

    if (data.search) {
      conditions.push(ilike(pressReleases.title, `%${data.search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: pressReleases.id,
          title: pressReleases.title,
          url: pressReleases.url,
          publishedDate: pressReleases.publishedDate,
          department: pressReleases.department,
          contentType: pressReleases.contentType,
          summary: pressReleases.summary,
          ministers: pressReleases.ministers,
          keywords: pressReleases.keywords,
          mentionedEntities: pressReleases.mentionedEntities,
          dollarAmounts: pressReleases.dollarAmounts,
        })
        .from(pressReleases)
        .where(whereClause)
        .orderBy(desc(pressReleases.publishedDate))
        .limit(data.pageSize)
        .offset(offset),
      db
        .select({ c: count() })
        .from(pressReleases)
        .where(whereClause),
    ])

    return {
      rows: rows as PressReleaseRow[],
      total: Number(totalResult[0]?.c ?? 0),
      page: data.page,
      pageSize: data.pageSize,
    }
  })

// ──────────────────────────────────────────────────────────────────────────────
// getNewsStats
// ──────────────────────────────────────────────────────────────────────────────

export const getNewsStats = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()

    const [statsResult] = await db.execute<{
      total: string
      departments: string
      latest: string | null
    }>(sql`
      SELECT
        COUNT(*)::text AS total,
        COUNT(DISTINCT department)::text AS departments,
        MAX(published_date)::text AS latest
      FROM press_releases
    `)

    // Content type breakdown
    const contentTypeRows = await db.execute<{ content_type: string | null; cnt: string }>(sql`
      SELECT content_type, COUNT(*)::text AS cnt
      FROM press_releases
      WHERE content_type IS NOT NULL
      GROUP BY content_type
      ORDER BY cnt::int DESC
      LIMIT 10
    `)

    return {
      total: Number(statsResult?.total ?? 0),
      departments: Number(statsResult?.departments ?? 0),
      latestDate: statsResult?.latest ?? null,
      contentTypes: Array.from(contentTypeRows).map((r) => ({
        name: r.content_type ?? '',
        count: Number(r.cnt),
      })),
    }
  })

// ──────────────────────────────────────────────────────────────────────────────
// getDepartmentListForNews
// ──────────────────────────────────────────────────────────────────────────────

export const getDepartmentListForNews = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()

    const rows = await db
      .selectDistinct({ department: pressReleases.department })
      .from(pressReleases)
      .where(isNotNull(pressReleases.department))
      .orderBy(pressReleases.department)

    return rows
      .map((r) => r.department)
      .filter((d): d is string => d !== null && d.length > 0)
  })

// ──────────────────────────────────────────────────────────────────────────────
// getEntityCrossReferences
// ──────────────────────────────────────────────────────────────────────────────

const GetEntityCrossReferencesInput = z.object({
  pressReleaseId: z.string(),
})

export const getEntityCrossReferences = createServerFn({ method: 'GET' })
  .inputValidator(GetEntityCrossReferencesInput)
  .handler(async ({ data }) => {
    const db = getDb()

    // Get the press release's mentionedEntities
    const pr = await db
      .select({ mentionedEntities: pressReleases.mentionedEntities })
      .from(pressReleases)
      .where(eq(pressReleases.id, data.pressReleaseId))
      .limit(1)

    const record = pr[0]
    if (!record?.mentionedEntities) {
      return { entities: [] as EntityCrossRef[] }
    }

    const mentioned = record.mentionedEntities as MentionedEntityRow[]
    const withEntityId = mentioned.filter((m) => m.entityId)

    if (withEntityId.length === 0) {
      return { entities: [] as EntityCrossRef[] }
    }

    // For each matched entity, query entity_connections for related counts
    const crossRefs: EntityCrossRef[] = []

    for (const mention of withEntityId) {
      if (!mention.entityId) continue

      // Query entity_connections aggregated by connection_type
      const connRows = await db.execute<{
        connection_type: string
        total_count: string
        total_value: string | null
      }>(sql`
        SELECT
          connection_type,
          COUNT(*)::text AS total_count,
          SUM(total_value)::text AS total_value
        FROM entity_connections
        WHERE entity_a_id = ${mention.entityId}::uuid
           OR entity_b_id = ${mention.entityId}::uuid
        GROUP BY connection_type
      `)

      const connections = { donations: 0, lobbying: 0, contracts: 0, totalValue: 0 }

      for (const row of connRows) {
        const cnt = Number(row.total_count)
        const val = Number(row.total_value ?? 0)
        if (row.connection_type === 'donation') {
          connections.donations += cnt
          connections.totalValue += val
        } else if (row.connection_type === 'lobby') {
          connections.lobbying += cnt
        } else if (row.connection_type === 'contract') {
          connections.contracts += cnt
          connections.totalValue += val
        }
      }

      crossRefs.push({
        name: mention.name,
        type: mention.type,
        entityId: mention.entityId,
        connections,
      })
    }

    return { entities: crossRefs }
  })
