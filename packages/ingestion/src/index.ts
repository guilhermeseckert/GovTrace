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
} else {
  console.log('GovTrace Ingestion Pipeline')
  console.log('Usage: pnpm ingest [source]')
  console.log(
    'Sources: elections-canada, contracts, grants, lobby-registrations, lobby-communications, all',
  )
}
