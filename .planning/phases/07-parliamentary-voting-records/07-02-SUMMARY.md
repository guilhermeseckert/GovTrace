---
phase: 07-parliamentary-voting-records
plan: "02"
subsystem: web-ui
tags: [parliament, voting-records, web-ui, profile-tabs, ai-summary, bill-pages, parl-02, parl-03, parl-04, parl-05]
dependency_graph:
  requires:
    - packages/db/src/schema/parliament.ts (5 tables from Plan 01)
    - apps/web/src/server-fns/datasets.ts (existing pattern)
    - apps/web/src/components/tables/AidTable.tsx (table pattern reference)
    - apps/web/src/components/entity/ProfileTabs.tsx (tab extension)
    - apps/web/src/server-fns/entity.ts (stats + provenance extension)
    - apps/web/src/server-fns/search.ts (counts extension)
    - apps/web/src/server-fns/summary.ts (AI summary upgrade)
  provides:
    - apps/web/src/server-fns/datasets.ts (getVotingRecord, getBillVotes, getBillSummary)
    - apps/web/src/components/tables/VotesTable.tsx
    - apps/web/src/routes/bill/$id.tsx
  affects:
    - apps/web/src/components/entity/ProfileTabs.tsx (votes tab + TabKey + TabCounts)
    - apps/web/src/routes/entity/$id.tsx (votes case, provenance display)
    - apps/web/src/server-fns/entity.ts (votes count + provenance)
    - apps/web/src/server-fns/search.ts (votes count in results)
    - apps/web/src/server-fns/summary.ts (PARL-04 voting pattern insights)
    - apps/web/src/routes/how-it-works.tsx (7th data source)
tech_stack:
  added: []
  patterns:
    - "PROMPT_VERSION -v3 suffix invalidates old cached summaries for politicians without DB migration"
    - "Party-grouped collapsible MP list in DivisionCard using Map<string, Ballot[]>"
    - "Votes tab uses same paginated useReactTable pattern as AidTable but without sorting (server handles order)"
key_files:
  created:
    - apps/web/src/components/tables/VotesTable.tsx
    - apps/web/src/routes/bill/$id.tsx
  modified:
    - apps/web/src/server-fns/datasets.ts
    - apps/web/src/components/entity/ProfileTabs.tsx
    - apps/web/src/routes/entity/$id.tsx
    - apps/web/src/server-fns/entity.ts
    - apps/web/src/server-fns/search.ts
    - apps/web/src/server-fns/summary.ts
    - apps/web/src/routes/how-it-works.tsx
    - apps/web/src/routeTree.gen.ts
decisions:
  - "PROMPT_VERSION -v3 invalidates all existing politician AI summaries so they regenerate with voting pattern context"
  - "VotesTable uses no sort controls (server always returns DESC voteDate — no UX need for re-sorting a chronological record)"
  - "DivisionCard MP list collapsed by default to avoid DOM overload on bills with hundreds of MPs"
  - "PARTY_ORDER const controls display order in bill breakdown: LPC/CPC/NDP/BQ/GPC/IND then any other"
metrics:
  duration: ~10 minutes
  completed: "2026-04-05"
  tasks: 2
  files: 9
---

# Phase 7 Plan 2: Parliamentary Voting Records Web UI Summary

**One-liner:** Votes tab on politician profiles + bill detail pages with AI summaries + party-grouped vote breakdowns + PARL-04 voting-donor cross-reference in AI summaries + 7th data source on How It Works.

## What Was Built

### Server Functions (apps/web/src/server-fns/datasets.ts)

Three new server functions:

**`getVotingRecord`** — For PARL-02. Accepts `{ entityId, page? }`. Joins `parliamentVoteBallots` (by entityId) with `parliamentVotes` and left-joins `parliamentBills` for bill titles. Returns paginated results (25/page) ordered by `voteDate DESC`. Fields: voteDate, subject, billNumber, billId (nullable FK), ballotValue, resultName, shortTitleEn, divisionNumber, parlSessionCode, parliamentNumber, sessionNumber.

**`getBillVotes`** — For PARL-03. Accepts `{ billId }`. Returns the bill record, bill summary (from `billSummaries`), and all divisions with their ballots grouped in a Map by voteId. Each division includes yeasTotal, naysTotal, resultName, and full ballot list with firstName/lastName/caucusShortName/ballotValue/entityId.

**`getBillSummary`** — Simple fetch of `billSummaries` by billId; returns `{ summaryText, model, generatedAt } | null`.

### VotesTable (apps/web/src/components/tables/VotesTable.tsx)

Paginated table following the AidTable pattern:
- Columns: Date, Bill/Motion (link to `/bill/{billId}` when non-null, otherwise plain subject text), Vote (Yea/Nay/Paired colour badge — green/red/gray), Result, Parliament-Session, Source link to ourcommons.ca
- Mobile card view with same data, compact layout
- Pagination with previous/next buttons and total count display
- Source URL constructed as `ourcommons.ca/members/en/votes/{parliament}/{session}/{divisionNumber}`

### Bill Detail Page (apps/web/src/routes/bill/$id.tsx)

New route `/bill/:id` (id = `"44-1-C-69"` format):
- **Hero header**: bill number, short/long title, bill type, parliament-session, sponsor, current status, LEGISinfo source link
- **AI summary panel**: displays `billSummary.summaryText` with AI label and model attribution; "Summary being generated..." placeholder when no summary yet
- **Vote breakdowns**: `DivisionCard` component per division, each showing yeas/nays/result summary + collapsible MP list grouped by party using `groupByParty()` function. Each MP links to `/entity/{entityId}` when matched
- Source links to both LEGISinfo (bill) and ourcommons.ca (per-division)

### ProfileTabs (apps/web/src/components/entity/ProfileTabs.tsx)

- Added `'votes'` to `TabKey` union type
- Added `votes: number` to `TabCounts`
- Added `votes` entry to `TAB_DESCRIPTIONS` with ourcommons.ca attribution
- Added `{ key: 'votes', label: 'Votes', count: 0 }` to `TABS` array between lobbying and aid

### Entity Route (apps/web/src/routes/entity/$id.tsx)

- Imported `VotesTable`
- Added `case 'votes': return <VotesTable entityId={profile.id} />` in renderTab switch
- Added votes provenance display in footer (same pattern as aid)

### Entity Stats + Provenance (apps/web/src/server-fns/entity.ts)

- Added `parliamentVoteBallots` import
- `getEntityStats`: added votes count query, returns `votes: number`
- `EntityProvenance` type: added `votes: string | null`
- `getEntityProvenance`: added 7th parallel query for `max(parliamentVoteBallots.ingestedAt)`

### Search (apps/web/src/server-fns/search.ts)

- Added `parliamentVoteBallots` import
- `getEntityCounts`: added votes count in parallel with other counts
- Default fallback includes `votes: 0`
- Return type updated to include `votes: number`

### AI Summary Upgrade (apps/web/src/server-fns/summary.ts) — PARL-04

- Updated `PROMPT_VERSION` from `-v2` to `-v3` — forces regeneration of all existing summaries
- `buildSummaryPrompt` accepts optional `voteCount`, `topYeaSubjects`, `topDonors`
- For politicians with votes > 0: adds a "Voting record:" section to the Claude prompt with total division count, top 5 Yea bill subjects (grouped by subject, ordered by Yea count), and top 5 donor names from entity_connections
- New prompt rule: "For politicians with votes, mention notable voting patterns if they connect with donor data"
- Enables insights like "Voted in favour of energy bills — received donations from oil companies"

### How It Works (apps/web/src/routes/how-it-works.tsx)

- Added `Gavel` icon import from lucide-react
- Added 7th entry to `DATA_SOURCES` array: Parliamentary Voting Records with Gavel icon, blue color, ourcommons.ca URL
- Updated FAQ "Where does the data come from?" from "Six" to "Seven" datasets, adding ourcommons.ca reference

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| PROMPT_VERSION -v3 invalidates all politician summaries | PARL-04 voting insights are significant enough that all existing politician summaries should regenerate with richer context |
| VotesTable has no sort controls | Server always returns DESC voteDate — chronological order is the only useful sort for a voting history |
| DivisionCard MP list collapsed by default | Some bills have 338+ ballots; showing them all expanded would create massive DOM and poor UX |
| PARTY_ORDER prioritizes LPC/CPC/NDP/BQ | Matches Canadian political convention for major parties; IND and others appear at end |

## Deviations from Plan

None — plan executed exactly as written. The stash incident during verification testing temporarily reverted files but did not affect the committed output (all changes were re-applied and committed cleanly).

## Known Stubs

None — all server functions are fully wired to real database tables. The bill AI summary panel shows a "Summary being generated..." placeholder when `billSummary` is null, which is intentional and expected behavior (summaries are generated by the ingestion pipeline, not on-demand in the web app).

## Self-Check: PASSED
