import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { count, desc, eq, or } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { contracts, donations, grants } from '@govtrace/db/schema/raw'
import { aiSummaries, entityAliases, entityMatchesLog, entities } from '@govtrace/db/schema/entities'

const EntityIdSchema = z.object({ id: z.string().uuid() })

export type EntityProfile = {
  id: string
  canonicalName: string
  entityType: string
  province: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  bestAlias: {
    matchMethod: string
    confidenceScore: number | null
    aiReasoning: string | null
  } | null
  // matchLogId: used by FlagModal to populate flags.matchLogId FK (COMM-03)
  matchLogId: string | null
}

export const getEntityProfile = createServerFn({ method: 'GET' })
  .validator((data: unknown) => EntityIdSchema.parse(data))
  .handler(async ({ data }): Promise<EntityProfile | null> => {
    const db = getDb()

    const entityRows = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id))
      .limit(1)

    if (entityRows.length === 0) return null
    const entity = entityRows[0]

    // Best alias = highest confidence score for this entity (AI-04)
    const bestAliasRows = await db
      .select({
        matchMethod: entityAliases.matchMethod,
        confidenceScore: entityAliases.confidenceScore,
        aiReasoning: entityAliases.aiReasoning,
      })
      .from(entityAliases)
      .where(eq(entityAliases.entityId, data.id))
      .orderBy(desc(entityAliases.confidenceScore))
      .limit(1)

    // Fetch most relevant matchLogId (highest AI confidence) for FlagModal (COMM-03)
    const matchLogRows = await db
      .select({ id: entityMatchesLog.id })
      .from(entityMatchesLog)
      .where(
        or(
          eq(entityMatchesLog.entityAId, data.id),
          eq(entityMatchesLog.entityBId, data.id),
        )
      )
      .orderBy(desc(entityMatchesLog.aiConfidence))
      .limit(1)

    return {
      ...entity,
      bestAlias: bestAliasRows[0] ?? null,
      matchLogId: matchLogRows[0]?.id ?? null,
    }
  })

// Stats for the tab count badges — returns row counts per dataset
export const getEntityStats = createServerFn({ method: 'GET' })
  .validator((data: unknown) => EntityIdSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // ai_summaries imported above — include summary freshness flag
    const [donCount, conCount, grCount, summaryRows] = await Promise.all([
      db.select({ c: count() }).from(donations).where(eq(donations.entityId, data.id)),
      db.select({ c: count() }).from(contracts).where(eq(contracts.entityId, data.id)),
      db.select({ c: count() }).from(grants).where(eq(grants.entityId, data.id)),
      db.select({ isStale: aiSummaries.isStale }).from(aiSummaries).where(eq(aiSummaries.entityId, data.id)).limit(1),
    ])

    return {
      donations: Number(donCount[0]?.c ?? 0),
      contracts: Number(conCount[0]?.c ?? 0),
      grants: Number(grCount[0]?.c ?? 0),
      lobbying: 0,
      connections: 0,
      hasFreshSummary: summaryRows.length > 0 && !summaryRows[0]?.isStale,
    }
  })
