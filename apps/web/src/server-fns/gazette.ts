import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { sql, count, desc, and, ilike, eq, isNotNull, lte, gte } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { gazetteRegulations, lobbyCommunications } from '@govtrace/db/schema/raw'

// ──────────────────────────────────────────────────────────────────────────────
// getRegulations
// ──────────────────────────────────────────────────────────────────────────────

const GetRegulationsInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  department: z.string().optional(),
  search: z.string().optional(),
})

export type RegulationRow = {
  id: string
  sorNumber: string | null
  title: string
  gazettePart: string
  publicationDate: string
  responsibleDepartment: string | null
  enablingAct: string | null
  gazetteUrl: string
  lobbyingSubjectCategories: string[] | null
}

export const getRegulations = createServerFn({ method: 'GET' })
  .inputValidator(GetRegulationsInput)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    const conditions = []

    if (data.department) {
      conditions.push(eq(gazetteRegulations.responsibleDepartment, data.department))
    }

    if (data.search) {
      conditions.push(ilike(gazetteRegulations.title, `%${data.search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: gazetteRegulations.id,
          sorNumber: gazetteRegulations.sorNumber,
          title: gazetteRegulations.title,
          gazettePart: gazetteRegulations.gazettePart,
          publicationDate: gazetteRegulations.publicationDate,
          responsibleDepartment: gazetteRegulations.responsibleDepartment,
          enablingAct: gazetteRegulations.enablingAct,
          gazetteUrl: gazetteRegulations.gazetteUrl,
          lobbyingSubjectCategories: gazetteRegulations.lobbyingSubjectCategories,
        })
        .from(gazetteRegulations)
        .where(whereClause)
        .orderBy(desc(gazetteRegulations.publicationDate))
        .limit(data.pageSize)
        .offset(offset),
      db
        .select({ c: count() })
        .from(gazetteRegulations)
        .where(whereClause),
    ])

    return {
      rows: rows as RegulationRow[],
      total: Number(totalResult[0]?.c ?? 0),
      page: data.page,
      pageSize: data.pageSize,
    }
  })

// ──────────────────────────────────────────────────────────────────────────────
// getRegulationLobbyingLinks
// ──────────────────────────────────────────────────────────────────────────────

const GetRegulationLobbyingLinksInput = z.object({
  regulationId: z.string(),
})

export type LobbyingLink = {
  lobbyistName: string
  clientName: string | null
  communicationDate: string
  subjectMatter: string | null
}

export const getRegulationLobbyingLinks = createServerFn({ method: 'GET' })
  .inputValidator(GetRegulationLobbyingLinksInput)
  .handler(async ({ data }) => {
    const db = getDb()

    // Get the regulation to find its categories and publication date
    const reg = await db
      .select({
        publicationDate: gazetteRegulations.publicationDate,
        lobbyingSubjectCategories: gazetteRegulations.lobbyingSubjectCategories,
      })
      .from(gazetteRegulations)
      .where(eq(gazetteRegulations.id, data.regulationId))
      .limit(1)

    const regulation = reg[0]
    if (!regulation || !regulation.lobbyingSubjectCategories || regulation.lobbyingSubjectCategories.length === 0) {
      return { links: [] as LobbyingLink[] }
    }

    const pubDate = regulation.publicationDate
    const categories = regulation.lobbyingSubjectCategories

    // Query lobby_communications where:
    //   subject_matter = ANY(categories)
    //   communication_date BETWEEN publicationDate - 90 days AND publicationDate
    const links = await db
      .select({
        lobbyistName: lobbyCommunications.lobbyistName,
        clientName: lobbyCommunications.clientName,
        communicationDate: lobbyCommunications.communicationDate,
        subjectMatter: lobbyCommunications.subjectMatter,
      })
      .from(lobbyCommunications)
      .where(
        and(
          sql`${lobbyCommunications.subjectMatter} = ANY(${sql.raw(`ARRAY[${categories.map((c) => `'${c.replace(/'/g, "''")}'`).join(',')}]`)})`,
          lte(lobbyCommunications.communicationDate, pubDate),
          gte(lobbyCommunications.communicationDate, sql`${pubDate}::date - INTERVAL '90 days'`),
          isNotNull(lobbyCommunications.subjectMatter),
        ),
      )
      .orderBy(desc(lobbyCommunications.communicationDate))
      .limit(20)

    return { links: links as LobbyingLink[] }
  })

// ──────────────────────────────────────────────────────────────────────────────
// getRegulationStats
// ──────────────────────────────────────────────────────────────────────────────

export type RegulationStats = {
  totalRegulations: number
  regulationsWithLobbyLinks: number
  uniqueDepartments: number
  earliestDate: string | null
  latestDate: string | null
}

export const getRegulationStats = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()

    const [statsResult] = await db.execute<{
      total: string
      with_lobby: string
      departments: string
      earliest: string | null
      latest: string | null
    }>(sql`
      SELECT
        COUNT(*)::text AS total,
        COUNT(CASE WHEN array_length(lobbying_subject_categories, 1) > 0 THEN 1 END)::text AS with_lobby,
        COUNT(DISTINCT responsible_department)::text AS departments,
        MIN(publication_date)::text AS earliest,
        MAX(publication_date)::text AS latest
      FROM gazette_regulations
    `)

    return {
      totalRegulations: Number(statsResult?.total ?? 0),
      regulationsWithLobbyLinks: Number(statsResult?.with_lobby ?? 0),
      uniqueDepartments: Number(statsResult?.departments ?? 0),
      earliestDate: statsResult?.earliest ?? null,
      latestDate: statsResult?.latest ?? null,
    } as RegulationStats
  })

// ──────────────────────────────────────────────────────────────────────────────
// getDepartmentList
// Returns distinct departments for the filter dropdown
// ──────────────────────────────────────────────────────────────────────────────

export const getDepartmentList = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()

    const rows = await db
      .selectDistinct({ department: gazetteRegulations.responsibleDepartment })
      .from(gazetteRegulations)
      .where(isNotNull(gazetteRegulations.responsibleDepartment))
      .orderBy(gazetteRegulations.responsibleDepartment)

    return rows
      .map((r) => r.department)
      .filter((d): d is string => d !== null)
  })
