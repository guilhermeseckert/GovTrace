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
  // NIGHTLY PIPELINE — single orchestrator job runs everything in sequence
  // Each phase waits for the previous to finish before starting the next.
  // No more fixed cron times — dependencies are respected.
  // ═══════════════════════════════════════════════════════════════════════

  const NIGHTLY_PIPELINE = 'nightly:pipeline'

  await boss.work(NIGHTLY_PIPELINE, { teamSize: 1, teamConcurrency: 1 }, async () => {
    const start = Date.now()
    const log = (msg: string) => console.log(`[nightly] ${msg}`)

    try {
      // Phase 1: Fast sources (parallel — independent of each other)
      log('Phase 1: Fast sources...')
      await Promise.all([
        (async () => { const { runPressReleasesIngestion } = await import('../runners/press-releases.ts'); await runPressReleasesIngestion() })(),
        (async () => { const { runFiscalIngestion } = await import('../runners/ingest-fiscal.ts'); await runFiscalIngestion() })(),
        (async () => { const { runGicAppointmentsIngestion } = await import('../runners/gic-appointments.ts'); await runGicAppointmentsIngestion() })(),
        (async () => { const { runGazetteIngestion } = await import('../runners/gazette.ts'); await runGazetteIngestion() })(),
        (async () => { const { runPublicAccountsIngestion } = await import('../runners/ingest-public-accounts.ts'); await runPublicAccountsIngestion() })(),
      ])
      log('Phase 1 done.')

      // Phase 2: Medium sources (parallel)
      log('Phase 2: Elections + lobbying...')
      await Promise.all([
        (async () => { const { runElectionsCanadaIngestion } = await import('../runners/elections-canada.ts'); await runElectionsCanadaIngestion() })(),
        (async () => { const { runLobbyRegistrationsIngestion } = await import('../runners/lobby-registrations.ts'); await runLobbyRegistrationsIngestion() })(),
        (async () => { const { runLobbyCommunicationsIngestion } = await import('../runners/lobby-communications.ts'); await runLobbyCommunicationsIngestion() })(),
      ])
      log('Phase 2 done.')

      // Phase 3: Heavy CSV sources (parallel)
      log('Phase 3: Contracts, grants, travel, hospitality...')
      await Promise.all([
        (async () => { const { runContractsIngestion } = await import('../runners/contracts.ts'); await runContractsIngestion() })(),
        (async () => { const { runGrantsIngestion } = await import('../runners/grants.ts'); await runGrantsIngestion() })(),
        (async () => { const { runTravelIngestion } = await import('../runners/travel.ts'); await runTravelIngestion() })(),
        (async () => { const { runHospitalityIngestion } = await import('../runners/hospitality.ts'); await runHospitalityIngestion() })(),
      ])
      log('Phase 3 done.')

      // Phase 4: Scraped sources (sequential — polite delays, don't hammer government sites)
      log('Phase 4: Parliament, senate, international aid...')
      const { runParliamentIngestion } = await import('../runners/parliament.ts')
      await runParliamentIngestion()
      const { runSenateIngestion } = await import('../runners/senate.ts')
      await runSenateIngestion()
      const { runInternationalAidIngestion } = await import('../runners/international-aid.ts')
      await runInternationalAidIngestion()
      log('Phase 4 done.')

      // Phase 5: Entity linking (strict sequence — each depends on previous)
      log('Phase 5: Match entities...')
      const { runMatchingPipeline } = await import('../matcher/run-matching.ts')
      await runMatchingPipeline()
      log('Phase 5 done.')

      log('Phase 6: Merge entities...')
      const { runCrossDatasetMerge } = await import('../matcher/cross-dataset-merge.ts')
      await runCrossDatasetMerge()
      log('Phase 6 done.')

      log('Phase 7: Build connections...')
      const { buildEntityConnections } = await import('../graph/build-connections.ts')
      await buildEntityConnections()
      log('Phase 7 done.')

      // Phase 8: Mark AI summaries stale
      log('Phase 8: Mark summaries stale...')
      const db = getDb()
      await db.update(aiSummaries).set({ isStale: true })
      log('Phase 8 done.')

      const elapsed = Math.round((Date.now() - start) / 1000 / 60)
      log(`Nightly pipeline complete in ${elapsed} minutes.`)
    } catch (err) {
      const elapsed = Math.round((Date.now() - start) / 1000 / 60)
      console.error(`[nightly] Pipeline failed after ${elapsed} minutes:`, err instanceof Error ? err.message : err)
      throw err // pg-boss will mark as failed and retry
    }
  })

  // Trigger the pipeline every night at midnight UTC
  await boss.schedule(NIGHTLY_PIPELINE, '0 0 * * *', {}, { tz: 'UTC' })

  console.log('Nightly pipeline scheduled (every day at midnight UTC):')
  console.log('  Phase 1: press-releases, fiscal, gic, gazette, public-accounts (parallel)')
  console.log('  Phase 2: elections-canada, lobby-registrations, lobby-communications (parallel, waits for Phase 1)')
  console.log('  Phase 3: contracts, grants, travel, hospitality (parallel, waits for Phase 2)')
  console.log('  Phase 4: parliament, senate, international-aid (sequential, waits for Phase 3)')
  console.log('  Phase 5: match-entities (waits for all ingestion)')
  console.log('  Phase 6: merge-entities (waits for matching)')
  console.log('  Phase 7: build-connections (waits for merge)')
  console.log('  Phase 8: mark-summaries-stale (waits for connections)')
}
