import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, '../../../.env') })

const command = process.argv[2]
const source = process.argv[3]

// --limit N flag: only process first N records (for testing)
const limitIdx = process.argv.indexOf('--limit')
const RECORD_LIMIT = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : undefined
if (RECORD_LIMIT) console.log(`[limit] Processing max ${RECORD_LIMIT.toLocaleString()} records`)

switch (command) {
  case 'ingest': {
    switch (source) {
      case 'elections-canada': {
        const { runElectionsCanadaIngestion } = await import('./runners/elections-canada.ts')
        await runElectionsCanadaIngestion()
        break
      }
      case 'contracts': {
        const { runContractsIngestion } = await import('./runners/contracts.ts')
        await runContractsIngestion()
        break
      }
      case 'grants': {
        const { runGrantsIngestion } = await import('./runners/grants.ts')
        await runGrantsIngestion()
        break
      }
      case 'lobby-registrations': {
        const { runLobbyRegistrationsIngestion } = await import('./runners/lobby-registrations.ts')
        await runLobbyRegistrationsIngestion()
        break
      }
      case 'lobby-communications': {
        const { runLobbyCommunicationsIngestion } = await import('./runners/lobby-communications.ts')
        await runLobbyCommunicationsIngestion()
        break
      }
      case 'all': {
        const { runElectionsCanadaIngestion } = await import('./runners/elections-canada.ts')
        const { runContractsIngestion } = await import('./runners/contracts.ts')
        const { runGrantsIngestion } = await import('./runners/grants.ts')
        const { runLobbyRegistrationsIngestion } = await import('./runners/lobby-registrations.ts')
        const { runLobbyCommunicationsIngestion } = await import('./runners/lobby-communications.ts')

        console.log('Running full ingestion for all 5 sources...')
        await runElectionsCanadaIngestion()
        await runContractsIngestion()
        await runGrantsIngestion()
        await runLobbyRegistrationsIngestion()
        await runLobbyCommunicationsIngestion()
        console.log('All sources ingested.')
        break
      }
      default: {
        console.error(`Unknown source: ${source ?? '(none)'}`)
        console.log(
          'Available: elections-canada, contracts, grants, lobby-registrations, lobby-communications, all',
        )
        process.exit(1)
      }
    }
    break
  }

  case 'build-connections': {
    const { buildEntityConnections } = await import('./graph/build-connections.ts')
    const result = await buildEntityConnections()
    console.log(`Built ${result.total} entity connections.`)
    break
  }

  case 'match': {
    const { runMatchingPipeline } = await import('./matcher/run-matching.ts')
    console.log('Running entity matching pipeline (Stages 1+2: deterministic + fuzzy)...')
    const stats = await runMatchingPipeline()
    console.log(`Matching complete:`)
    console.log(`  Total names processed: ${stats.total.toLocaleString()}`)
    console.log(`  Deterministic matches: ${stats.deterministic.toLocaleString()}`)
    console.log(`  High-confidence fuzzy: ${stats.highConfidenceFuzzy.toLocaleString()}`)
    console.log(`  Medium-confidence (queued for AI): ${stats.mediumConfidenceQueued.toLocaleString()}`)
    console.log(`  New entities created: ${stats.newEntities.toLocaleString()}`)
    break
  }

  case 'scheduler': {
    const databaseUrl = process.env['DATABASE_URL']
    if (!databaseUrl) throw new Error('DATABASE_URL required for scheduler')
    const { registerIngestionJobs } = await import('./scheduler/jobs.ts')
    await registerIngestionJobs(databaseUrl)
    // Keep process alive for scheduler
    console.log('Scheduler running. Press Ctrl+C to stop.')
    process.on('SIGINT', () => {
      console.log('Scheduler stopped.')
      process.exit(0)
    })
    break
  }

  default: {
    console.log('GovTrace Ingestion Pipeline')
    console.log('')
    console.log('Usage: pnpm ingest <command> [source]')
    console.log('')
    console.log('Commands:')
    console.log('  ingest <source>       Ingest data from a source')
    console.log('  build-connections     Rebuild entity_connections table from all sources')
    console.log('  scheduler             Start the pg-boss scheduled job runner')
    console.log('')
    console.log('Ingest sources:')
    console.log(
      '  elections-canada, contracts, grants, lobby-registrations, lobby-communications, all',
    )
  }
}
