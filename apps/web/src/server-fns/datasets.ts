import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { count, desc, eq, or, sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { contracts, donations, grants, lobbyCommunications, lobbyRegistrations } from '@govtrace/db/schema/raw'
import { entityConnections } from '@govtrace/db/schema/connections'
import { entities } from '@govtrace/db/schema/entities'

const DatasetInputSchema = z.object({
  entityId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(50).default(25),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

export const getDonations = createServerFn({ method: 'GET' })
  .inputValidator(DatasetInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    // Check entity type — politicians receive donations (match by recipient_name),
    // persons/organizations make donations (match by entity_id)
    const entity = await db.select({ canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities).where(eq(entities.id, data.entityId)).limit(1)

    const isPolitician = entity[0]?.entityType === 'politician'
    const entityName = entity[0]?.canonicalName ?? ''

    // For politicians: use materialized view for fast count, raw table for paginated rows
    // Raw table query uses the idx_donations_recipient_name index with LIMIT
    const whereClause = isPolitician
      ? eq(donations.recipientName, entityName)
      : eq(donations.entityId, data.entityId)

    // Fast count from materialized view for politicians (avoids 23s seq scan)
    const totalCountPromise = isPolitician
      ? db.execute<{ c: string }>(sql`
          SELECT SUM(donation_count)::text AS c FROM mv_donation_summaries
          WHERE recipient_name = ${entityName}
        `).then(r => Number(Array.from(r)[0]?.c ?? 0))
      : db.select({ c: count() }).from(donations).where(whereClause)
          .then(r => Number(r[0]?.c ?? 0))

    const [rows, totalCount] = await Promise.all([
      db.select({
        id: donations.id,
        contributorName: donations.contributorName,
        contributorType: donations.contributorType,
        amount: donations.amount,
        donationDate: donations.donationDate,
        recipientName: donations.recipientName,
        recipientType: donations.recipientType,
        province: donations.province,
        electionYear: donations.electionYear,
        rawData: donations.rawData,
      })
      .from(donations)
      .where(whereClause)
      .orderBy(desc(donations.donationDate))
      .limit(data.pageSize)
      .offset(offset),

      totalCountPromise,
    ])

    return {
      rows,
      total: totalCount,
      page: data.page,
      pageSize: data.pageSize,
    }
  })

export const getContracts = createServerFn({ method: 'GET' })
  .inputValidator(DatasetInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: contracts.id,
        contractId: contracts.contractId,
        vendorName: contracts.vendorName,
        department: contracts.department,
        description: contracts.description,
        value: contracts.value,
        originalValue: contracts.originalValue,
        awardDate: contracts.awardDate,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        procurementMethod: contracts.procurementMethod,
        province: contracts.province,
        rawData: contracts.rawData,  // PROF-05: contains source URL fields
      })
      .from(contracts)
      .where(eq(contracts.entityId, data.entityId))
      .orderBy(desc(contracts.awardDate))
      .limit(data.pageSize)
      .offset(offset),

      db.select({ c: count() }).from(contracts).where(eq(contracts.entityId, data.entityId)),
    ])

    return {
      rows,
      total: Number(totalRows[0]?.c ?? 0),
      page: data.page,
      pageSize: data.pageSize,
    }
  })

export const getGrants = createServerFn({ method: 'GET' })
  .inputValidator(DatasetInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: grants.id,
        recipientName: grants.recipientName,
        recipientLegalName: grants.recipientLegalName,
        department: grants.department,
        programName: grants.programName,
        description: grants.description,
        amount: grants.amount,
        agreementDate: grants.agreementDate,  // confirmed column name from schema
        startDate: grants.startDate,
        endDate: grants.endDate,
        province: grants.province,
        city: grants.city,
        grantType: grants.grantType,
        rawData: grants.rawData,  // PROF-05: contains source URL fields
      })
      .from(grants)
      .where(eq(grants.entityId, data.entityId))
      .orderBy(desc(grants.agreementDate))
      .limit(data.pageSize)
      .offset(offset),

      db.select({ c: count() }).from(grants).where(eq(grants.entityId, data.entityId)),
    ])

    return {
      rows,
      total: Number(totalRows[0]?.c ?? 0),
      page: data.page,
      pageSize: data.pageSize,
    }
  })

export const getLobbying = createServerFn({ method: 'GET' })
  .inputValidator(DatasetInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    // lobbyRegistrations uses lobbyistEntityId and clientEntityId (no single entityId FK)
    // lobbyCommunications uses lobbyistEntityId and officialEntityId
    // Query both tables where this entity appears in either role
    const [regRows, regCount, commRows, commCount] = await Promise.all([
      db.select({
        id: lobbyRegistrations.id,
        registrationNumber: lobbyRegistrations.registrationNumber,
        lobbyistName: lobbyRegistrations.lobbyistName,
        lobbyistType: lobbyRegistrations.lobbyistType,
        clientName: lobbyRegistrations.clientName,
        subjectMatter: lobbyRegistrations.subjectMatter,
        status: lobbyRegistrations.status,
        registrationDate: lobbyRegistrations.registrationDate,
        province: lobbyRegistrations.province,
        rawData: lobbyRegistrations.rawData,
      })
      .from(lobbyRegistrations)
      .where(
        or(
          eq(lobbyRegistrations.lobbyistEntityId, data.entityId),
          eq(lobbyRegistrations.clientEntityId, data.entityId),
        )
      )
      .orderBy(desc(lobbyRegistrations.registrationDate))
      .limit(data.pageSize)
      .offset(offset),

      db.select({ c: count() }).from(lobbyRegistrations).where(
        or(
          eq(lobbyRegistrations.lobbyistEntityId, data.entityId),
          eq(lobbyRegistrations.clientEntityId, data.entityId),
        )
      ),

      db.select({
        id: lobbyCommunications.id,
        registrationNumber: lobbyCommunications.registrationNumber,
        communicationDate: lobbyCommunications.communicationDate,
        lobbyistName: lobbyCommunications.lobbyistName,
        clientName: lobbyCommunications.clientName,
        publicOfficialName: lobbyCommunications.publicOfficialName,
        publicOfficialTitle: lobbyCommunications.publicOfficialTitle,
        department: lobbyCommunications.department,
        subjectMatter: lobbyCommunications.subjectMatter,
        communicationMethod: lobbyCommunications.communicationMethod,
        rawData: lobbyCommunications.rawData,
      })
      .from(lobbyCommunications)
      .where(
        or(
          eq(lobbyCommunications.lobbyistEntityId, data.entityId),
          eq(lobbyCommunications.officialEntityId, data.entityId),
        )
      )
      .orderBy(desc(lobbyCommunications.communicationDate))
      .limit(data.pageSize)
      .offset(offset),

      db.select({ c: count() }).from(lobbyCommunications).where(
        or(
          eq(lobbyCommunications.lobbyistEntityId, data.entityId),
          eq(lobbyCommunications.officialEntityId, data.entityId),
        )
      ),
    ])

    const totalRegistrations = Number(regCount[0]?.c ?? 0)
    const totalCommunications = Number(commCount[0]?.c ?? 0)

    return {
      rows: {
        registrations: regRows,
        communications: commRows,
      },
      total: totalRegistrations + totalCommunications,
      page: data.page,
      pageSize: data.pageSize,
    }
  })

export const getConnections = createServerFn({ method: 'GET' })
  .inputValidator(DatasetInputSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const offset = (data.page - 1) * data.pageSize

    // entityConnections has entityAId / entityBId — query both directions
    // Join entities table to resolve canonical names for display (API-04)
    const entitiesAlias = entities

    const [rowsA, rowsB, countA, countB] = await Promise.all([
      // This entity appears as entityA — connected to entityB
      db.select({
        id: entityConnections.id,
        connectedEntityId: entityConnections.entityBId,
        connectionType: entityConnections.connectionType,
        totalValue: entityConnections.totalValue,
        transactionCount: entityConnections.transactionCount,
        firstSeen: entityConnections.firstSeen,
        lastSeen: entityConnections.lastSeen,
        sourceTable: entityConnections.sourceTable,
        connectedEntityName: entitiesAlias.canonicalName,
        connectedEntityType: entitiesAlias.entityType,
      })
      .from(entityConnections)
      .innerJoin(entitiesAlias, eq(entitiesAlias.id, entityConnections.entityBId))
      .where(eq(entityConnections.entityAId, data.entityId))
      .limit(data.pageSize)
      .offset(offset),

      // This entity appears as entityB — connected to entityA
      db.select({
        id: entityConnections.id,
        connectedEntityId: entityConnections.entityAId,
        connectionType: entityConnections.connectionType,
        totalValue: entityConnections.totalValue,
        transactionCount: entityConnections.transactionCount,
        firstSeen: entityConnections.firstSeen,
        lastSeen: entityConnections.lastSeen,
        sourceTable: entityConnections.sourceTable,
        connectedEntityName: entitiesAlias.canonicalName,
        connectedEntityType: entitiesAlias.entityType,
      })
      .from(entityConnections)
      .innerJoin(entitiesAlias, eq(entitiesAlias.id, entityConnections.entityAId))
      .where(eq(entityConnections.entityBId, data.entityId))
      .limit(data.pageSize)
      .offset(offset),

      db.select({ c: count() }).from(entityConnections).where(eq(entityConnections.entityAId, data.entityId)),
      db.select({ c: count() }).from(entityConnections).where(eq(entityConnections.entityBId, data.entityId)),
    ])

    return {
      rows: [...rowsA, ...rowsB],
      total: Number(countA[0]?.c ?? 0) + Number(countB[0]?.c ?? 0),
      page: data.page,
      pageSize: data.pageSize,
    }
  })
