import PgBoss from 'pg-boss'
import { getDb } from '@govtrace/db/client'
import { aiSummaries } from '@govtrace/db/schema/entities'

// Job names as const for type safety
export const JOB_NAMES = {
  INGEST_ELECTIONS_CANADA: 'ingest:elections-canada',
  INGEST_CONTRACTS: 'ingest:contracts',
  INGEST_GRANTS: 'ingest:grants',
  INGEST_LOBBY_REGISTRATIONS: 'ingest:lobby-registrations',
  INGEST_LOBBY_COMMUNICATIONS: 'ingest:lobby-communications',
  INGEST_INTERNATIONAL_AID: 'ingest:international-aid',
  INGEST_PARLIAMENT: 'ingest-parliament',
  INGEST_SENATE: 'ingest:senate',
  INGEST_FISCAL: 'ingest:fiscal',
  INGEST_PUBLIC_ACCOUNTS: 'ingest:public-accounts',
  INGEST_GIC_APPOINTMENTS: 'ingest:gic-appointments',
  INGEST_TRAVEL: 'ingest:travel',
  INGEST_HOSPITALITY: 'ingest:hospitality',
  INGEST_GAZETTE: 'ingest:gazette',
  INGEST_PRESS_RELEASES: 'ingest:press-releases',
  MATCH_ENTITIES: 'match:entities',
  MERGE_ENTITIES: 'merge:cross-dataset',
  BUILD_CONNECTIONS: 'build:entity-connections',
  MARK_SUMMARIES_STALE: 'mark-summaries-stale',
} as const

/**
 * Registers all ingestion jobs with pg-boss and starts the scheduler.
 * - Elections Canada: weekly (every Sunday at 2am UTC)
 * - Lobbying sources: weekly (every Sunday at 3am and 4am UTC)
 * - Contracts + Grants: quarterly (first Sunday of Jan, Apr, Jul, Oct)
 * - Build connections: weekly after ingestion runs (Sunday 8am UTC)
 *
 * D-03: pg-boss uses the existing PostgreSQL database — no Redis needed.
 * D-04: all 5 sources can run in parallel as independent pg-boss jobs.
 */
export async function registerIngestionJobs(databaseUrl: string): Promise<void> {
  const boss = new PgBoss(databaseUrl)

  boss.on('error', (error: Error) => {
    console.error('pg-boss error:', error.message)
  })

  await boss.start()
  console.log('pg-boss started')

  // Register job handlers — use dynamic imports so each job loads lazily
  await boss.work(JOB_NAMES.INGEST_ELECTIONS_CANADA, async () => {
    const { runElectionsCanadaIngestion } = await import('../runners/elections-canada.ts')
    await runElectionsCanadaIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_CONTRACTS, async () => {
    const { runContractsIngestion } = await import('../runners/contracts.ts')
    await runContractsIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_GRANTS, async () => {
    const { runGrantsIngestion } = await import('../runners/grants.ts')
    await runGrantsIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_LOBBY_REGISTRATIONS, async () => {
    const { runLobbyRegistrationsIngestion } = await import('../runners/lobby-registrations.ts')
    await runLobbyRegistrationsIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_LOBBY_COMMUNICATIONS, async () => {
    const { runLobbyCommunicationsIngestion } = await import('../runners/lobby-communications.ts')
    await runLobbyCommunicationsIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_INTERNATIONAL_AID, async () => {
    const { runInternationalAidIngestion } = await import('../runners/international-aid.ts')
    await runInternationalAidIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_PARLIAMENT, async () => {
    const { runParliamentIngestion } = await import('../runners/parliament.ts')
    await runParliamentIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_SENATE, async () => {
    const { runSenateIngestion } = await import('../runners/senate.ts')
    await runSenateIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_FISCAL, async () => {
    const { runFiscalIngestion } = await import('../runners/ingest-fiscal.ts')
    await runFiscalIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_PUBLIC_ACCOUNTS, async () => {
    const { runPublicAccountsIngestion } = await import('../runners/ingest-public-accounts.ts')
    await runPublicAccountsIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_GIC_APPOINTMENTS, async () => {
    const { runGicAppointmentsIngestion } = await import('../runners/gic-appointments.ts')
    await runGicAppointmentsIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_TRAVEL, async () => {
    const { runTravelIngestion } = await import('../runners/travel.ts')
    await runTravelIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_HOSPITALITY, async () => {
    const { runHospitalityIngestion } = await import('../runners/hospitality.ts')
    await runHospitalityIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_GAZETTE, async () => {
    const { runGazetteIngestion } = await import('../runners/gazette.ts')
    await runGazetteIngestion()
  })

  await boss.work(JOB_NAMES.INGEST_PRESS_RELEASES, async () => {
    const { runPressReleasesIngestion } = await import('../runners/press-releases.ts')
    await runPressReleasesIngestion()
  })

  await boss.work(JOB_NAMES.MATCH_ENTITIES, async () => {
    const { runMatchingPipeline } = await import('../matcher/run-matching.ts')
    await runMatchingPipeline()
  })

  await boss.work(JOB_NAMES.MERGE_ENTITIES, async () => {
    const { runCrossDatasetMerge } = await import('../matcher/cross-dataset-merge.ts')
    await runCrossDatasetMerge()
  })

  await boss.work(JOB_NAMES.BUILD_CONNECTIONS, async () => {
    const { buildEntityConnections } = await import('../graph/build-connections.ts')
    await buildEntityConnections()
  })

  // Register mark-summaries-stale job handler (AI-03)
  await boss.work(JOB_NAMES.MARK_SUMMARIES_STALE, async () => {
    const db = getDb()
    await db.update(aiSummaries).set({ isStale: true })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // NIGHTLY SCHEDULE — runs every night starting at midnight UTC
  // All ingestion first, then match → merge → build connections → stale
  // ═══════════════════════════════════════════════════════════════════════

  // Phase 1: Fast sources (midnight–1am) — press releases, fiscal, GIC
  await boss.schedule(JOB_NAMES.INGEST_PRESS_RELEASES, '0 0 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_FISCAL, '5 0 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_GIC_APPOINTMENTS, '10 0 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_GAZETTE, '15 0 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_PUBLIC_ACCOUNTS, '20 0 * * *', {}, { tz: 'UTC' })

  // Phase 2: Medium sources (1am–2am) — elections, lobbying
  await boss.schedule(JOB_NAMES.INGEST_ELECTIONS_CANADA, '0 1 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_LOBBY_REGISTRATIONS, '15 1 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_LOBBY_COMMUNICATIONS, '30 1 * * *', {}, { tz: 'UTC' })

  // Phase 3: Heavy sources (2am–4am) — contracts, grants, travel, hospitality
  await boss.schedule(JOB_NAMES.INGEST_CONTRACTS, '0 2 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_GRANTS, '30 2 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_TRAVEL, '0 3 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_HOSPITALITY, '30 3 * * *', {}, { tz: 'UTC' })

  // Phase 4: Scraped sources (4am) — parliament, senate, international aid
  await boss.schedule(JOB_NAMES.INGEST_PARLIAMENT, '0 4 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_SENATE, '30 4 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.INGEST_INTERNATIONAL_AID, '45 4 * * *', {}, { tz: 'UTC' })

  // Phase 5: Linking (5am–7am) — match → merge → build connections
  await boss.schedule(JOB_NAMES.MATCH_ENTITIES, '0 5 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.MERGE_ENTITIES, '0 6 * * *', {}, { tz: 'UTC' })
  await boss.schedule(JOB_NAMES.BUILD_CONNECTIONS, '0 7 * * *', {}, { tz: 'UTC' })

  // Phase 6: Cleanup (8am) — mark AI summaries stale so they regenerate
  await boss.schedule(JOB_NAMES.MARK_SUMMARIES_STALE, '0 8 * * *', {}, { tz: 'UTC' })

  console.log('Nightly jobs scheduled (every day):')
  console.log('  00:00 press-releases, fiscal, gic, gazette, public-accounts')
  console.log('  01:00 elections-canada, lobby-registrations, lobby-communications')
  console.log('  02:00 contracts, grants')
  console.log('  03:00 travel, hospitality')
  console.log('  04:00 parliament, senate, international-aid')
  console.log('  05:00 match-entities')
  console.log('  06:00 merge-entities')
  console.log('  07:00 build-connections')
  console.log('  08:00 mark-summaries-stale')
}
