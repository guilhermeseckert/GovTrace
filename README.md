# GovTrace

**Follow the money. Connect the dots. Hold power accountable.**

GovTrace is an open-source civic transparency platform that traces the flow of money and influence across Canadian federal government datasets. Search any politician, company, or person and instantly see their donations, contracts, lobbying, grants, international aid, and parliamentary votes in one place.

**Live:** [govtrace.ca](https://govtrace.ca)

Canada's answer to [OpenSecrets](https://www.opensecrets.org/).

## Why this exists

Billions of taxpayer dollars flow through government contracts, grants, and international aid every year. Lobbyists meet with officials behind closed doors. Politicians vote on bills that affect the companies donating to their campaigns. All of this data is public, but it's scattered across dozens of government websites in different formats.

GovTrace connects these dots so anyone can search a name and see the full picture, with clarity a 9-year-old could follow.

## What you can do

- **Search any name** and instantly see all their connections across 7 government datasets
- **Read AI-generated plain-language summaries** that explain relationships in simple English
- **Trace paths** between any two entities through 2-3 degrees of separation
- **See where aid money goes** by country, with drill-down to individual projects
- **Track national debt vs overseas spending** with interactive timeline charts
- **See how politicians voted** on every bill and cross-reference with their donors
- **Spot patterns** like donation spikes near contract awards (anomaly detection)
- **Download CSV exports** of any dataset for your own analysis
- **Explore visualizations** including network graphs, money flow diagrams, and activity timelines

## Data Sources

| Source | What it contains | Records |
|--------|-----------------|---------|
| [Elections Canada](https://www.elections.ca/) | Political contributions (2004-present) | Weekly updates |
| [Open Canada - Contracts](https://open.canada.ca/) | Federal government contracts | Quarterly |
| [Open Canada - Grants](https://open.canada.ca/) | Federal grants and contributions | Quarterly |
| [Lobby Canada](https://lobbycanada.gc.ca/) | Lobbyist registrations | Weekly |
| [Lobby Canada](https://lobbycanada.gc.ca/) | Lobbying communication reports | Weekly |
| [Global Affairs Canada (IATI)](https://open.canada.ca/) | International aid projects by country | 8,400+ projects |
| [House of Commons](https://www.ourcommons.ca/) | Parliamentary votes, bills, MP ballots | 1M+ ballots |
| [Statistics Canada](https://www150.statcan.gc.ca/) | National debt and fiscal snapshots | Monthly |

## Tech Stack

- **Frontend:** TanStack Start, React 19, shadcn/ui, Tailwind CSS v4, Recharts, D3.js
- **Backend:** TanStack Start server functions, PostgreSQL 16, Drizzle ORM
- **AI:** Claude API (entity matching + plain-language summaries + bill explainers)
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
# Edit .env with your DATABASE_URL and ANTHROPIC_API_KEY

# Run database migrations
cd packages/db && pnpm drizzle-kit migrate && cd ../..

# Start the web app
pnpm --filter @govtrace/web dev
```

### Ingest Data

```bash
# Ingest individual sources
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest elections-canada
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest contracts
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest grants
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest lobby-registrations
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest lobby-communications
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest international-aid
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest parliament
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest fiscal

# Or ingest all original 5 sources at once
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest all

# Run entity matching + merge + build connections
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest match
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest merge-entities
pnpm --filter @govtrace/ingestion tsx src/index.ts ingest build-connections
```

## Environment Variables

```env
DATABASE_URL=postgres://govtrace:govtrace@localhost:5432/govtrace
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
PORT=3000
```

## Data Ethics

- **Never editorialize** or imply wrongdoing
- **Always link** to the original government data source
- **Always show AI confidence** scores for entity matching
- **Always caveat** connections: "Connections shown do not imply wrongdoing"
- **Pattern flags** include disclaimer: "Temporal proximity does not imply a causal relationship"

## Roadmap

### v1.0 MVP (Shipped)
- [x] Data Foundation (5 source ingestion pipeline + entity matching)
- [x] Search and Entity Profiles
- [x] Interactive Visualizations (network graph, Sankey, timeline)
- [x] How It Works educational page
- [x] Entity Profile Storytelling (AI summaries, plain English connection cards)

### v2.0 International Money Tracking (Shipped)
- [x] International Aid Ingestion (8,400+ IATI projects from Global Affairs Canada)
- [x] Debt vs Spending Dashboard (national debt timeline with election markers)
- [x] Parliamentary Voting Records (1M+ ballots, bills with AI summaries)
- [x] Aid Country & Sector Breakdown (drill-down by country, searchable sectors)
- [x] CSV Export (download any dataset)
- [x] Multi-Hop Path Finding (trace connections 2-3 degrees of separation)
- [x] Anomaly Flagging (donation spikes, lobbying clusters, outlier detection)

### Backlog
- [ ] Newsletter and weekly digest
- [ ] Ingestion hash-check optimization (skip unchanged files)

## Contributing

GovTrace is open source under the MIT license. Contributions welcome! If you're a journalist, researcher, or developer interested in civic transparency, open an issue or PR.

## License

MIT
