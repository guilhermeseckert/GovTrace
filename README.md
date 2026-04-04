# GovTrace

**Follow the money. Connect the dots.**

GovTrace is an open-source civic tech platform that connects Canadian federal government political donations, lobbying activity, government contracts, and grants into a single searchable interface. Type a name and instantly see all their connections across public government datasets.

Canada's answer to [OpenSecrets](https://www.opensecrets.org/).

## What it does

Search any politician, company, or person and instantly see:
- Who donated to them and how much
- What government contracts they received
- Which lobbyists are connected to them
- What grants they were awarded
- AI-generated plain-language summaries connecting the dots
- Interactive visualizations showing money flow and relationship networks

All data sourced from public Canadian government datasets under the Open Government Licence.

## Data Sources

| Source | What it contains | Update frequency |
|--------|-----------------|------------------|
| [Elections Canada](https://www.elections.ca/) | Political contributions (2004-present) | Weekly |
| [Open Canada - Contracts](https://open.canada.ca/) | Federal government contracts | Quarterly |
| [Open Canada - Grants](https://open.canada.ca/) | Federal grants and contributions | Quarterly |
| [Lobby Canada](https://lobbycanada.gc.ca/) | Lobbyist registrations | Weekly |
| [Lobby Canada](https://lobbycanada.gc.ca/) | Lobbying communication reports | Weekly |

## Tech Stack

- **Frontend:** TanStack Start, React 19, shadcn/ui, Tailwind CSS v4, D3.js
- **Backend:** TanStack Start server functions, PostgreSQL 16, Drizzle ORM
- **AI:** Claude API (entity matching verification + summary generation)
- **Infrastructure:** Docker, Coolify on Hetzner
- **Language:** TypeScript (strict mode)
- **Monorepo:** pnpm workspaces

## Project Structure

```
govtrace/
  apps/
    web/              # TanStack Start web application
    ingestion/        # Data ingestion pipeline + scheduler
  packages/
    db/               # Shared database schema (Drizzle ORM)
  docker/
    postgres-init.sql # PostgreSQL extensions (pg_trgm)
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- PostgreSQL 16 (via Docker or local)

### Setup

```bash
# Clone
git clone https://github.com/guilhermeseckert/GovTrace.git
cd GovTrace

# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up postgres -d

# Copy environment file
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# Run database migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Start the web app
pnpm --filter @govtrace/web dev
```

### Ingest Data

```bash
# Ingest all 5 data sources
pnpm --filter @govtrace/ingestion ingest all

# Run entity matching
pnpm --filter @govtrace/ingestion ingest match

# Merge entities across datasets
pnpm --filter @govtrace/ingestion ingest merge-entities

# Build relationship graph
pnpm --filter @govtrace/ingestion ingest build-connections
```

### Deploy (Coolify on Hetzner)

```bash
# Build and deploy all services
docker compose up -d

# The scheduler runs automatically:
# Sunday 2-5am: Ingest all sources
# Sunday 6am:   Match entities
# Sunday 7am:   Merge cross-dataset duplicates
# Sunday 8am:   Build connections
# Sunday 10pm:  Mark AI summaries stale
```

## Environment Variables

```env
DATABASE_URL=postgres://govtrace:govtrace@localhost:5432/govtrace
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
PORT=3000
```

## Data Ethics

- Never editorialize or imply wrongdoing
- Always link to the original government data source
- Always show AI confidence scores for entity matching
- Always caveat connections: "Connections shown do not imply wrongdoing"

## Roadmap

### v1.0 (Current)
- [x] Phase 1: Data Foundation (5 source ingestion pipeline)
- [x] Phase 2: Search and Entity Profiles
- [x] Phase 3: Interactive Visualizations (network graph, Sankey, timeline)
- [x] Phase 4.1: How It Works page
- [ ] Phase 4.2: Entity Profile Storytelling (AI stories, plain English connection cards)
- [ ] Phase 4: Newsletter + Secondary Visualizations

### v2.0 (Planned)
- [ ] Phase 5: International Aid Tracking (IATI data from Global Affairs Canada)
- [ ] Phase 6: Debt vs Spending Dashboard (national debt comparison)
- [ ] Phase 7: Parliamentary Voting Records (how MPs voted + cross-reference with donors)

## License

MIT
