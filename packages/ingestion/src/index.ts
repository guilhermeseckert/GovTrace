// GovTrace ingestion pipeline entry point
// Individual source runners are added in subsequent plans

const command = process.argv[2]

if (command === 'ingest') {
  console.log('Ingestion pipeline — use specific source commands')
  console.log('Available sources: elections-canada, contracts, grants, lobby-registrations, lobby-communications')
} else {
  console.log('GovTrace Ingestion Pipeline')
  console.log('Usage: pnpm ingest [command]')
}
