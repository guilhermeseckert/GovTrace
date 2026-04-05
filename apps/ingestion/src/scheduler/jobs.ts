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
  MATCH_ENTITIES: 'match:entities',
  MERGE_ENTITIES: 'merge:cross-dataset',
  BUILD_CONNECTIONS: 'build:entity-connections',
  INGEST_INTERNATIONAL_AID: 'ingest:international-aid',
  INGEST_PARLIAMENT: 'ingest-parliament',
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

  // Schedule recurring jobs — cron syntax
  // Weekly: Elections Canada (Sunday 2am UTC)
  await boss.schedule(JOB_NAMES.INGEST_ELECTIONS_CANADA, '0 2 * * 0', {}, {
    tz: 'UTC',
  })

  // Weekly: Lobbying sources (Sunday 3am and 4am UTC)
  await boss.schedule(JOB_NAMES.INGEST_LOBBY_REGISTRATIONS, '0 3 * * 0', {}, {
    tz: 'UTC',
  })
  await boss.schedule(JOB_NAMES.INGEST_LOBBY_COMMUNICATIONS, '0 4 * * 0', {}, {
    tz: 'UTC',
  })

  // Quarterly: contracts + grants (first Sunday of Jan, Apr, Jul, Oct)
  await boss.schedule(JOB_NAMES.INGEST_CONTRACTS, '0 5 1-7 1,4,7,10 0', {}, {
    tz: 'UTC',
  })
  await boss.schedule(JOB_NAMES.INGEST_GRANTS, '0 6 1-7 1,4,7,10 0', {}, {
    tz: 'UTC',
  })

  // Monthly: international aid (first Sunday of each month at 5:30am UTC)
  await boss.schedule(JOB_NAMES.INGEST_INTERNATIONAL_AID, '30 5 1-7 * 0', {}, {
    tz: 'UTC',
  })

  // Weekly: parliament votes, bills, and summaries (Sunday 2am UTC — after elections-canada at midnight)
  await boss.schedule(JOB_NAMES.INGEST_PARLIAMENT, '0 2 * * 0', {}, {
    tz: 'UTC',
  })

  // Match entities: weekly after all ingestion runs (Sunday 6am UTC)
  await boss.schedule(JOB_NAMES.MATCH_ENTITIES, '0 6 * * 0', {}, {
    tz: 'UTC',
  })

  // Merge cross-dataset duplicates: weekly after matching (Sunday 7am UTC)
  await boss.schedule(JOB_NAMES.MERGE_ENTITIES, '0 7 * * 0', {}, {
    tz: 'UTC',
  })

  // Build connections: weekly after merge (Sunday 8am UTC)
  await boss.schedule(JOB_NAMES.BUILD_CONNECTIONS, '0 8 * * 0', {}, {
    tz: 'UTC',
  })

  // Register mark-summaries-stale job handler (AI-03)
  await boss.work(JOB_NAMES.MARK_SUMMARIES_STALE, async () => {
    const db = getDb()
    await db.update(aiSummaries).set({ isStale: true })
  })

  // Mark all ai_summaries as stale every Sunday night (22:00 UTC) — after build-connections
  // This forces fresh generation on next profile view after weekly data ingestion (AI-03)
  await boss.schedule(JOB_NAMES.MARK_SUMMARIES_STALE, '0 22 * * 0', {}, {
    tz: 'UTC',
  })

  console.log('Ingestion jobs scheduled:')
  console.log('  Weekly (Sunday 2am): elections-canada')
  console.log('  Weekly (Sunday 3-4am): lobby-registrations, lobby-communications')
  console.log('  Quarterly (first Sunday 5am): contracts, grants')
  console.log('  Monthly (first Sunday 5:30am): international-aid')
  console.log('  Weekly (Sunday 6am): match-entities')
  console.log('  Weekly (Sunday 7am): merge-cross-dataset')
  console.log('  Weekly (Sunday 8am): build-connections')
  console.log('  Weekly (Sunday 2am): parliament')
  console.log('  Weekly (Sunday 10pm): mark-summaries-stale')
}
