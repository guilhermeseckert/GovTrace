import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { count, desc, eq, max, or } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { contracts, donations, grants, hospitalityDisclosures, internationalAid, lobbyCommunications, lobbyRegistrations, travelDisclosures } from '@govtrace/db/schema/raw'
import { aiSummaries, entityAliases, entityMatchesLog, entities } from '@govtrace/db/schema/entities'
import { entityConnections } from '@govtrace/db/schema/connections'
import { parliamentVoteBallots } from '@govtrace/db/schema/parliament'
import { gicAppointments } from '@govtrace/db/schema/appointments'
import { cached } from '@/lib/cache'

// Loader-path caches. Route loader runs 3 queries (profile, stats, provenance)
// in parallel; stats alone fires 11 count() queries. Caching absorbs the worst
// of the 504 pattern on heavy entities (1000+ contracts).
const PROFILE_TTL_MS = 5 * 60 * 1000
const STATS_TTL_MS = 5 * 60 * 1000
const PROVENANCE_TTL_MS = 10 * 60 * 1000

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
  .handler(({ data }): Promise<EntityProfile | null> =>
    cached(
      `entity-profile:${data.id}`,
      async () => {
        const db = getDb()

        const entityRows = await db
          .select()
          .from(entities)
          .where(eq(entities.id, data.id))
          .limit(1)

        if (entityRows.length === 0) return null
        const entity = entityRows[0]
        if (!entity) return null

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
      },
      PROFILE_TTL_MS,
    ),
  )

// Data provenance: per-dataset max(ingestedAt) timestamps (PROF-06)
export type EntityProvenance = {
  donations: string | null
  contracts: string | null
  grants: string | null
  lobbying: string | null
  aid: string | null
  votes: string | null
  travel: string | null
  hospitality: string | null
}

export const getEntityProvenance = createServerFn({ method: 'GET' })
  .inputValidator(EntityIdSchema)
  .handler(({ data }): Promise<EntityProvenance> =>
    cached(
      `entity-provenance:${data.id}`,
      async () => {
        const db = getDb()

    const [donResult, conResult, grResult, lobRegResult, lobCommResult, aidResult, voteResult, travelResult, hospitalityResult] =
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
        db
          .select({ maxDate: max(travelDisclosures.ingestedAt) })
          .from(travelDisclosures)
          .where(eq(travelDisclosures.entityId, data.id)),
        db
          .select({ maxDate: max(hospitalityDisclosures.ingestedAt) })
          .from(hospitalityDisclosures)
          .where(eq(hospitalityDisclosures.entityId, data.id)),
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
    const travelDate = travelResult[0]?.maxDate
    const hospitalityDate = hospitalityResult[0]?.maxDate

        return {
          donations: donDate ? donDate.toISOString() : null,
          contracts: conDate ? conDate.toISOString() : null,
          grants: grDate ? grDate.toISOString() : null,
          lobbying: lobbyingDate,
          aid: aidDate ? aidDate.toISOString() : null,
          votes: voteDate ? voteDate.toISOString() : null,
          travel: travelDate ? travelDate.toISOString() : null,
          hospitality: hospitalityDate ? hospitalityDate.toISOString() : null,
        }
      },
      PROVENANCE_TTL_MS,
    ),
  )

// Stats for the tab count badges — returns row counts per dataset
export const getEntityStats = createServerFn({ method: 'GET' })
  .inputValidator(EntityIdSchema)
  .handler(({ data }) =>
    cached(
      `entity-stats:${data.id}`,
      async () => {
        const db = getDb()

    // Check entity type — politicians receive donations, others make them
    const entity = await db.select({ canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities).where(eq(entities.id, data.id)).limit(1)

    const isPolitician = entity[0]?.entityType === 'politician'
    const canonicalName = entity[0]?.canonicalName ?? ''
    // For politicians: check both "First Last" and "Last, First" formats in recipient_name
    const donWhere = isPolitician && canonicalName
      ? or(
          eq(donations.recipientName, canonicalName),
          eq(donations.entityId, data.id),
        )
      : eq(donations.entityId, data.id)

    const [donCount, conCount, grCount, lobCount, connCount, summaryRows, aidCount, voteCount, apptCount, travelCount, hospitalityCount] = await Promise.all([
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
      db.select({ c: count() }).from(travelDisclosures).where(eq(travelDisclosures.entityId, data.id)),
      db.select({ c: count() }).from(hospitalityDisclosures).where(eq(hospitalityDisclosures.entityId, data.id)),
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
          travel: Number(travelCount[0]?.c ?? 0),
          hospitality: Number(hospitalityCount[0]?.c ?? 0),
          hasFreshSummary: summaryRows.length > 0 && !summaryRows[0]?.isStale,
        }
      },
      STATS_TTL_MS,
    ),
  )
