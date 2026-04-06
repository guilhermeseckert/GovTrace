import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { count, desc, eq, max, or } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { contracts, donations, grants, internationalAid, lobbyCommunications, lobbyRegistrations } from '@govtrace/db/schema/raw'
import { aiSummaries, entityAliases, entityMatchesLog, entities } from '@govtrace/db/schema/entities'
import { entityConnections } from '@govtrace/db/schema/connections'
import { parliamentVoteBallots } from '@govtrace/db/schema/parliament'
import { gicAppointments } from '@govtrace/db/schema/appointments'

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
  .inputValidator(EntityIdSchema)
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

// Data provenance: per-dataset max(ingestedAt) timestamps (PROF-06)
export type EntityProvenance = {
  donations: string | null
  contracts: string | null
  grants: string | null
  lobbying: string | null
  aid: string | null
  votes: string | null
}

export const getEntityProvenance = createServerFn({ method: 'GET' })
  .inputValidator(EntityIdSchema)
  .handler(async ({ data }): Promise<EntityProvenance> => {
    const db = getDb()

    const [donResult, conResult, grResult, lobRegResult, lobCommResult, aidResult, voteResult] =
      await Promise.all([
        db
          .select({ maxDate: max(donations.ingestedAt) })
          .from(donations)
          .where(eq(donations.entityId, data.id)),
        db
          .select({ maxDate: max(contracts.ingestedAt) })
          .from(contracts)
          .where(eq(contracts.entityId, data.id)),
        db
          .select({ maxDate: max(grants.ingestedAt) })
          .from(grants)
          .where(eq(grants.entityId, data.id)),
        db
          .select({ maxDate: max(lobbyRegistrations.ingestedAt) })
          .from(lobbyRegistrations)
          .where(
            or(
              eq(lobbyRegistrations.lobbyistEntityId, data.id),
              eq(lobbyRegistrations.clientEntityId, data.id),
            ),
          ),
        db
          .select({ maxDate: max(lobbyCommunications.ingestedAt) })
          .from(lobbyCommunications)
          .where(
            or(
              eq(lobbyCommunications.lobbyistEntityId, data.id),
              eq(lobbyCommunications.officialEntityId, data.id),
            ),
          ),
        db
          .select({ maxDate: max(internationalAid.ingestedAt) })
          .from(internationalAid)
          .where(eq(internationalAid.entityId, data.id)),
        db
          .select({ maxDate: max(parliamentVoteBallots.ingestedAt) })
          .from(parliamentVoteBallots)
          .where(eq(parliamentVoteBallots.entityId, data.id)),
      ])

    // Pick the most recent lobbying timestamp between registrations and communications
    const lobRegDate = lobRegResult[0]?.maxDate ?? null
    const lobCommDate = lobCommResult[0]?.maxDate ?? null
    let lobbyingDate: string | null = null
    if (lobRegDate && lobCommDate) {
      lobbyingDate =
        new Date(lobRegDate) >= new Date(lobCommDate)
          ? lobRegDate.toISOString()
          : lobCommDate.toISOString()
    } else if (lobRegDate) {
      lobbyingDate = lobRegDate.toISOString()
    } else if (lobCommDate) {
      lobbyingDate = lobCommDate.toISOString()
    }

    const donDate = donResult[0]?.maxDate
    const conDate = conResult[0]?.maxDate
    const grDate = grResult[0]?.maxDate
    const aidDate = aidResult[0]?.maxDate
    const voteDate = voteResult[0]?.maxDate

    return {
      donations: donDate ? donDate.toISOString() : null,
      contracts: conDate ? conDate.toISOString() : null,
      grants: grDate ? grDate.toISOString() : null,
      lobbying: lobbyingDate,
      aid: aidDate ? aidDate.toISOString() : null,
      votes: voteDate ? voteDate.toISOString() : null,
    }
  })

// Stats for the tab count badges — returns row counts per dataset
export const getEntityStats = createServerFn({ method: 'GET' })
  .inputValidator(EntityIdSchema)
  .handler(async ({ data }) => {
    const db = getDb()

    // Check entity type — politicians receive donations, others make them
    const entity = await db.select({ canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities).where(eq(entities.id, data.id)).limit(1)

    const isPolitician = entity[0]?.entityType === 'politician'
    const donWhere = isPolitician && entity[0]?.canonicalName
      ? eq(donations.recipientName, entity[0].canonicalName)
      : eq(donations.entityId, data.id)

    const [donCount, conCount, grCount, lobCount, connCount, summaryRows, aidCount, voteCount, apptCount] = await Promise.all([
      db.select({ c: count() }).from(donations).where(donWhere),
      db.select({ c: count() }).from(contracts).where(eq(contracts.entityId, data.id)),
      db.select({ c: count() }).from(grants).where(eq(grants.entityId, data.id)),
      db.select({ c: count() }).from(lobbyRegistrations).where(
        or(eq(lobbyRegistrations.lobbyistEntityId, data.id), eq(lobbyRegistrations.clientEntityId, data.id))
      ),
      db.select({ c: count() }).from(entityConnections).where(
        or(eq(entityConnections.entityAId, data.id), eq(entityConnections.entityBId, data.id))
      ),
      db.select({ isStale: aiSummaries.isStale }).from(aiSummaries).where(eq(aiSummaries.entityId, data.id)).limit(1),
      db.select({ c: count() }).from(internationalAid).where(eq(internationalAid.entityId, data.id)),
      db.select({ c: count() }).from(parliamentVoteBallots).where(eq(parliamentVoteBallots.entityId, data.id)),
      db.select({ c: count() }).from(gicAppointments).where(eq(gicAppointments.entityId, data.id)),
    ])

    return {
      donations: Number(donCount[0]?.c ?? 0),
      contracts: Number(conCount[0]?.c ?? 0),
      grants: Number(grCount[0]?.c ?? 0),
      lobbying: Number(lobCount[0]?.c ?? 0),
      connections: Number(connCount[0]?.c ?? 0),
      aid: Number(aidCount[0]?.c ?? 0),
      votes: Number(voteCount[0]?.c ?? 0),
      appointments: Number(apptCount[0]?.c ?? 0),
      hasFreshSummary: summaryRows.length > 0 && !summaryRows[0]?.isStale,
    }
  })
