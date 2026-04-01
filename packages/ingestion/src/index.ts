const command = process.argv[2]
const source = process.argv[3]

if (command === 'ingest') {
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
    case 'all': {
      // lobby sources added in Plan 05
      const { runElectionsCanadaIngestion } = await import('./runners/elections-canada.ts')
      const { runContractsIngestion } = await import('./runners/contracts.ts')
      const { runGrantsIngestion } = await import('./runners/grants.ts')
      await runElectionsCanadaIngestion()
      await runContractsIngestion()
      await runGrantsIngestion()
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
} else {
  console.log('GovTrace Ingestion Pipeline')
  console.log('Usage: pnpm ingest [source]')
  console.log(
    'Sources: elections-canada, contracts, grants, lobby-registrations, lobby-communications, all',
  )
}
