# Phase 1: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 01-Data Foundation
**Areas discussed:** Shared DB package, Ingestion strategy, Matching pipeline, Deployment setup

---

## Shared DB Package

| Option | Description | Selected |
|--------|-------------|----------|
| packages/db (Recommended) | Dedicated shared package. Both ingestion and web import from it. Avoids circular deps and the Drizzle multi-instance bug. | ✓ |
| packages/web | Schema lives in web, ingestion imports from web. Simpler but creates a dependency from ingestion → web. | |
| You decide | Claude picks the best approach during planning | |

**User's choice:** packages/db (Recommended)
**Notes:** None — straightforward choice aligned with research recommendation.

---

## Ingestion Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| pg-boss (Recommended) | PostgreSQL-native job queue. Each source is a job. Supports retries, scheduling, and parallel execution. No Redis needed. | ✓ |
| Simple scripts | Sequential Node scripts run by cron. Simpler, but no retry/monitoring built in. | |
| You decide | Claude picks based on research | |

**User's choice:** pg-boss (Recommended)
**Notes:** None

---

## Matching Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Global pass (Recommended) | Ingest all sources first, then run one unified matching pass across all entities. Simpler, better cross-dataset matches. | ✓ |
| Per-source then cross | Match within each source first (dedup), then cross-match between sources. More complex but catches intra-source duplicates first. | |
| You decide | Claude picks based on research | |

**User's choice:** Global pass (Recommended)
**Notes:** None

### Backfill Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Batch API (Recommended) | Use Claude Batch API for all historical matching. 50% cost savings, async processing. Match in bulk after all data is ingested. | ✓ |
| Incremental batches | Process one year at a time, match as you go. Slower but lets you validate early. | |
| You decide | Claude picks based on cost analysis | |

**User's choice:** Batch API (Recommended)
**Notes:** None

---

## Deployment Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Single compose (Recommended) | One docker-compose.yml with PostgreSQL + web + ingestion services. Coolify deploys the same file. Use 'expose:' not 'ports:' for PostgreSQL. | ✓ |
| Separate dev/prod | docker-compose.yml for local dev, separate Dockerfile + Coolify config for production. | |
| You decide | Claude picks based on Coolify research | |

**User's choice:** Single compose (Recommended)
**Notes:** None

---

## Claude's Discretion

- CSV parser library choice
- pg-boss job configuration details
- Drizzle migration strategy
- Docker Compose service naming
- Natural key composition per data source

## Deferred Ideas

None — discussion stayed within phase scope
