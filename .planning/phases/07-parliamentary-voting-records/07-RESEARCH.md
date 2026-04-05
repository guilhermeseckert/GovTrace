# Phase 7: Parliamentary Voting Records - Research

**Researched:** 2026-04-04
**Domain:** House of Commons Open Data — XML ingestion, bill/vote schema, MP entity matching, AI bill summaries
**Confidence:** HIGH (primary sources verified directly against live government endpoints)

---

## Summary

The House of Commons publishes voting records through two complementary endpoints on ourcommons.ca. The aggregate vote listing (one record per division) is available as XML by parliament-session. Individual MP ballots per vote are available as a separate per-vote XML endpoint. Both formats use fast-xml-parser, which is already in the codebase. Bill metadata (titles, reading dates, royal assent) comes from LEGISinfo (parl.ca) as JSON. The openparliament.ca API provides a third access pattern with JSON and pre-built bilingual descriptions, but rate limits make it unsuitable for bulk historical ingestion.

The full historical dataset covers 16 parliament-sessions since the 37th Parliament (January 2001) through the current 45th Parliament (ongoing). Estimated total divisions: 6,000–8,000 across all sessions; individual ballot rows: approximately 1.5–2.5 million (338+ MPs per vote). The openparliament.ca PostgreSQL data dump (1.2 GB compressed, 6 GB uncompressed, updated monthly) is a usable alternative for historical data if direct XML scraping proves too slow.

MP entity matching is structurally different from other GovTrace sources. MPs have government-assigned `PersonId` integers that are stable per person across sessions. The VoteParticipant XML records include first name, last name, constituency, province, and caucus (party) — enough for deterministic matching against `entities` where `entityType = 'politician'`. AI disambiguation is warranted only when two different MPs share a name across different eras.

**Primary recommendation:** Ingest aggregate vote listings first (one HTTP request per parliament-session, 16 requests total for history), then fetch per-vote participant XML in batches (one request per division). Store `PersonId` as a stable cross-session key. Use LEGISinfo JSON for bill metadata. Generate bill summaries with Claude Sonnet using bill title + LEGISinfo long title as input.

---

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| PARL-01 | Voting records from House of Commons Open Data ingested for all parliaments since 2001 | 16 sessions confirmed via `ourcommons.ca/members/en/votes/xml?parlSession={parliament}-{session}`. Individual votes via `ourcommons.ca/members/en/votes/{parliament}/{session}/{voteNum}/xml`. See "Data Sources" section. |
| PARL-02 | Politician entity profiles show a "Votes" tab listing every bill they voted on (Yea/Nay/Absent) | `vote_ballots` table with `entity_id` FK; web layer queries ballots by entity. MP names + PersonId enable deterministic entity matching. |
| PARL-03 | Bills are searchable — search "Bill C-69" and see all MPs who voted, grouped by party and position | `bills` table searchable by bill_number with pg_trgm; `vote_ballots` join to `votes` join to `bills`; result grouped by `caucus_short_name` and `ballot_value`. |
| PARL-04 | AI summary for politicians includes voting pattern insights cross-referenced with donors | Voting pattern query: count of bills voted Yea by subject area + donation data from existing `entity_connections`. Feed to `aiSummaries` prompt (extends existing system). |
| PARL-05 | Every bill has an AI-generated plain-language summary — grandpa-readable | LEGISinfo `LongTitleEn` + `ShortTitleEn` + subject_matter as Claude input. New `bill_summaries` table parallel to existing `ai_summaries`. |

</phase_requirements>

---

## Data Sources

### Source 1: Aggregate Vote Listing (per parliament-session)

**URL pattern:**
```
https://www.ourcommons.ca/members/en/votes/xml?parlSession={parliament}-{session}
```

**Example:** `https://www.ourcommons.ca/members/en/votes/xml?parlSession=44-1`

**Format:** XML — root element `<ArrayOfVote>`, child elements `<Vote>`

**Fields per Vote element:**

| XML Element | Type | Example | Notes |
|-------------|------|---------|-------|
| `ParliamentNumber` | int | 44 | |
| `SessionNumber` | int | 1 | |
| `DecisionDivisionNumber` | int | 928 | Vote number within session — used as part of composite PK |
| `DecisionEventDateTime` | datetime | 2024-12-17T... | |
| `DecisionDivisionSubject` | text | "Motion respecting..." | Bill description or motion title |
| `DecisionResultName` | text | "Agreed To" / "Negatived" | |
| `DecisionDivisionNumberOfYeas` | int | 200 | |
| `DecisionDivisionNumberOfNays` | int | 115 | |
| `DecisionDivisionNumberOfPaired` | int | 10 | |
| `DecisionDivisionDocumentTypeName` | text | "Legislative Process" | Category |
| `DecisionDivisionDocumentTypeId` | int | 1 | Numeric type |
| `BillNumberCode` | text | "C-69" | Nullable — only present when vote is on a bill |
| `PersonId` | int | 0 | Always 0 in this aggregate view |

**Record counts verified (confidence HIGH):**
- 37th Parliament (2001–2004): ~3 sessions, ~300–500 votes total (estimated)
- 38th Parliament 1st Session (2004–2005): 190+ divisions
- 39th Parliament (2006–2008): 219+ divisions per session
- 41st Parliament 2nd Session (2013–2015): 467+ divisions
- 42nd Parliament 1st Session (2015–2019): 1,379 divisions (longest single session)
- 44th Parliament 1st Session (2021–2025): 928 divisions (confirmed from live data)
- 45th Parliament 1st Session (2025–): 94 divisions as of March 2026

**Estimated total historical divisions: 6,000–8,000**

**37th Parliament availability:** `parlSession=37-1` returns HTTP 500. The 37th Parliament (2001) is the earliest LEGISinfo coverage but ourcommons.ca XML may not serve it. Start with 38th Parliament (2004) as confirmed working baseline. Investigate 37th at implementation time.

### Source 2: Individual MP Vote Ballots (per division)

**URL pattern:**
```
https://www.ourcommons.ca/members/en/votes/{parliament}/{session}/{voteNumber}/xml
```

**Example:** `https://www.ourcommons.ca/members/en/votes/44/1/377/xml`

**Format:** XML — root element `<ArrayOfVoteParticipant>`, child elements `<VoteParticipant>`

**Fields per VoteParticipant element:**

| XML Element | Type | Example | Notes |
|-------------|------|---------|-------|
| `PersonId` | int | 89156 | Stable numeric ID per person — key for entity matching |
| `ParliamentNumber` | int | 44 | |
| `SessionNumber` | int | 1 | |
| `DecisionDivisionNumber` | int | 377 | FK to aggregate vote |
| `DecisionEventDateTime` | datetime | 2023-06-14T... | |
| `PersonShortSalutation` | text | "Mr." / "Ms." | |
| `PersonOfficialFirstName` | text | "Ziad" | |
| `PersonOfficialLastName` | text | "Aboultaif" | |
| `ConstituencyName` | text | "Edmonton Manning" | |
| `ConstituencyProvinceTerritoryName` | text | "Alberta" | |
| `CaucusShortName` | text | "CPC" | Party abbreviation |
| `VoteValueName` | text | "Yea" / "Nay" / "Paired" | |
| `IsVoteYea` | bool | true/false | |
| `IsVoteNay` | bool | true/false | |
| `IsVotePaired` | bool | true/false | |
| `DecisionResultName` | text | "Agreed To" | Division outcome (same for all in this vote) |

**Participant count per vote:** ~338 (current House size); historical sessions may have fewer for early parliaments.

**Estimated total ballot rows:** 6,000–8,000 divisions × ~300 MPs average = **1.8–2.4 million rows**

### Source 3: Members of Parliament List (per parliament-session)

**URL pattern:**
```
https://www.ourcommons.ca/members/en/search/xml?parlSession={parliament}-{session}
```

**Format:** XML — `<ArrayOfMemberOfParliament>`, child `<MemberOfParliament>`

**Fields:** `PersonId`, `PersonOfficialFirstName`, `PersonOfficialLastName`, `ConstituencyName`, `ConstituencyProvinceTerritoryName`, `CaucusShortName`, `FromDateTime`, `ToDateTime`

**Purpose:** Seed the MPs table and build `PersonId` → `entity_id` lookup before processing ballots. ~340 records per session, instant download.

### Source 4: LEGISinfo Bills (per parliament-session)

**URL pattern:**
```
https://www.parl.ca/legisinfo/en/bills/json?parlsession={parliament}-{session}&Language=E
```

**Format:** JSON array — no explicit pagination; returns all bills for a session (~75–200 depending on session activity)

**Key fields per bill:**

| JSON Field | Type | Example | Notes |
|------------|------|---------|-------|
| `BillId` | int | 1082 | Internal LEGISinfo ID |
| `BillNumberFormatted` | text | "C-69" | Human-readable bill number |
| `LongTitleEn` | text | "An Act to enact..." | Full legislative title — primary input for AI summary |
| `ShortTitleEn` | text | "Impact Assessment Act" | Short name — use in UI |
| `CurrentStatusEn` | text | "Royal assent received" | |
| `ReceivedRoyalAssentDateTime` | datetime | nullable | |
| `PassedHouseThirdReadingDateTime` | datetime | nullable | |
| `BillTypeEn` | text | "Government Bill" | |
| `SponsorEn` | text | "Hon. Catherine McKenna" | |
| `ParlSessionCode` | text | "44-1" | |

**No description/synopsis field exists.** AI summaries must be generated from `LongTitleEn` + `ShortTitleEn` + context about the bill's reading stage and subject matter.

### Source 5: openparliament.ca API (supplemental / historical fallback)

**Base URL:** `https://api.openparliament.ca/`

**Votes endpoint:** `GET /votes/?format=json&limit=N&offset=N`

**Ballots endpoint:** `GET /votes/ballots/?vote={vote_url}&format=json&limit=N`

**Vote fields:** `session`, `number`, `date`, `description` (bilingual), `result`, `yea_total`, `nay_total`, `paired_total`, `bill_url`, `ballots_url`

**Ballot fields:** `vote_url`, `politician_url`, `politician_membership_url`, `ballot` ("Yes"/"No")

**Rate limit:** HTTP 429 if too many concurrent requests — no documented per-minute limit

**Coverage:** The API returns empty arrays for sessions before 38th Parliament (37-1 and 37-2 return `"objects": []`). Data starts from approximately the 38th Parliament.

**Bulk alternative:** openparliament.ca publishes a PostgreSQL dump at `https://openparliament.ca/data-download/` — compressed ~1.2 GB, uncompressed ~6 GB, updated monthly. This provides all vote and ballot data in relational form without per-request overhead.

**Recommendation:** Use ourcommons.ca XML as primary source (government-authoritative, no rate limits found). Use openparliament.ca dump as fallback if XML scraping is too slow for historical backfill.

---

## Parliament Sessions Reference

All sessions since 2001 with confirmed XML availability:

| Parliament | Session | Dates | Status |
|-----------|---------|-------|--------|
| 37th | 1 | 2001-01-29 to 2002-09-16 | XML returns 500 — verify at implementation |
| 37th | 2 | 2002-09-30 to 2003-11-12 | XML returns 500 — verify at implementation |
| 37th | 3 | 2004-02-02 to 2004-05-23 | XML returns 500 — verify at implementation |
| 38th | 1 | 2004-10-04 to 2005-11-28 | **Confirmed working** — 190+ divisions |
| 39th | 1 | 2006-04-03 to 2007-09-14 | **Confirmed working** — 219+ divisions |
| 39th | 2 | 2007-10-16 to 2008-09-07 | Available (standard session) |
| 40th | 1 | 2008-11-18 to 2008-12-04 | Available (short session ~30 votes) |
| 40th | 2 | 2009-01-26 to 2009-12-30 | Available |
| 40th | 3 | 2010-03-03 to 2011-03-26 | Available |
| 41st | 1 | 2011-06-02 to 2013-09-13 | Available |
| 41st | 2 | 2013-10-16 to 2015-08-02 | **Confirmed working** — 467 divisions |
| 42nd | 1 | 2015-12-03 to 2019-09-11 | **Confirmed working** — 1,379 divisions (largest) |
| 43rd | 1 | 2019-12-05 to 2020-08-18 | Available |
| 43rd | 2 | 2020-09-23 to 2021-08-15 | Available |
| 44th | 1 | 2021-11-22 to 2025-01-06 | **Confirmed working** — 928 divisions |
| 45th | 1 | 2025-05-26 to present | **Confirmed working** — 94+ divisions (active) |

**Total sessions to ingest: 16** (13 confirmed, 3 flagged for 37th Parliament investigation)

---

## Standard Stack

### Core (already in codebase)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `fast-xml-parser` | 5.5.10 (catalog) | Parse `ArrayOfVoteParticipant` and `ArrayOfVote` XML | Already installed — used for IATI |
| `drizzle-orm` | 0.45.x (catalog) | Schema definition and upserts | Already installed |
| `@anthropic-ai/sdk` | 0.80.x (catalog) | Bill summary generation via Claude | Already installed |
| `pg-boss` | 9.x (catalog) | Schedule weekly/historical ingestion jobs | Already installed |
| `postgres` | catalog | DB driver | Already installed |

### No new packages required
The parliamentary ingestion pipeline needs no new npm packages. All dependencies are present. The XML format (`ArrayOfVoteParticipant`) is structurally similar to the IATI XML already parsed — same `fast-xml-parser` config patterns apply.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
packages/db/src/schema/
├── parliament.ts              # bills, votes, vote_ballots, bill_summaries, mp_profiles tables

apps/ingestion/src/
├── downloaders/
│   └── parliament.ts          # HTTP fetch for XML/JSON endpoints
├── parsers/
│   ├── parliament-votes.ts    # parse ArrayOfVote XML → VoteRecord[]
│   ├── parliament-ballots.ts  # parse ArrayOfVoteParticipant XML → BallotRecord[]
│   └── parliament-bills.ts    # parse LEGISinfo JSON → BillRecord[]
├── upsert/
│   ├── parliament-votes.ts    # INSERT ON CONFLICT DO UPDATE for votes + bills
│   └── parliament-ballots.ts  # batch INSERT ON CONFLICT DO NOTHING for ballots
├── runners/
│   └── parliament.ts          # orchestrator: sessions loop → votes → ballots → entity matching
└── scheduler/jobs.ts          # add INGEST_PARLIAMENT job (weekly Sunday 1am UTC)
```

### Pattern 1: Two-Phase Ingestion (Aggregate First, Then Ballots)

**What:** Ingest all session-level vote summaries first in a single pass, then fetch individual MP ballots for each division.

**Why:** The aggregate vote listing gives all division numbers upfront (one request per session). The ballot endpoint requires one request per division. Separating phases allows progress tracking and resumable ingestion.

**Implementation sketch:**
```typescript
// Phase A: aggregate votes — 16 requests total for full history
for (const session of PARLIAMENT_SESSIONS) {
  const xml = await fetchVotesXml(session.parliament, session.session)
  const votes = parseVotesXml(xml, session)
  await upsertVotes(votes)  // bills are linked here via BillNumberCode
}

// Phase B: ballots — one request per division (6,000–8,000 total)
const unprocessedVotes = await getVotesWithoutBallots()
for (const vote of unprocessedVotes) {
  const xml = await fetchBallotsXml(vote.parliament, vote.session, vote.divisionNumber)
  const ballots = parseBallotsXml(xml)
  await upsertBallots(ballots)
  await sleep(100)  // courteous delay — no rate limit documented but be respectful
}
```

### Pattern 2: PersonId-First MP Entity Matching

**What:** Before processing ballots, build a `personid_to_entity_id` lookup by matching the Members XML against the existing `entities` table.

**Why:** `PersonId` integers are stable per person across sessions. Once matched, all 1.8M ballot rows can be linked to `entity_id` without per-row AI calls.

**Implementation sketch:**
```typescript
// Run once per session before ballot ingestion
const members = await fetchMembersXml(parliament, session)  // ~340 MPs
for (const mp of members) {
  const entityId = await matchMpToEntity(mp)  // deterministic + fuzzy + AI
  await upsertMpProfile(mp.personId, entityId, parliament, session)
}

// Ballot upsert references mp_profiles by personId — no per-ballot matching
await db.insert(voteBallots).values(
  ballots.map(b => ({
    voteId: voteId,
    personId: b.personId,
    entityId: personIdToEntityMap.get(b.personId) ?? null,
    ballotValue: b.voteValueName,
    // ...
  }))
).onConflictDoNothing()
```

### Pattern 3: MP Name Normalization for Entity Matching

The `entities` table currently has politicians from donations data (candidate names from Elections Canada). MP names in voting records include French characters and honorific prefixes.

**Normalization steps (add to existing `normalizeName`):**
1. Strip salutations: "Mr.", "Ms.", "Mrs.", "Hon.", "Right Hon.", "Dr."
2. Normalize Unicode: "é" → "e", "ô" → "o" (existing `normalize.ts` handles this)
3. Match on `PersonOfficialFirstName + " " + PersonOfficialLastName`
4. If no entity match: create a new entity with `entityType = 'politician'`, `province = ConstituencyProvinceTerritoryName`

**Disambiguation issue:** Same name, different people across eras (e.g., two MPs named "John Turner" at different times). `PersonId` integer is the ground truth — use it as the primary key in the `mp_profiles` table. Entity matching is a best-effort link to the existing entity graph, not a hard requirement for ballot ingestion.

### Pattern 4: Bill AI Summary Generation

**What:** After ingesting bills from LEGISinfo, generate plain-language summaries on demand (lazy, cached in `bill_summaries`).

**When:** Generate on first view of a bill page, or in a batch job after ingestion.

**Claude model:** `claude-haiku-3-5` for well-described bills (title is clear); `claude-sonnet-4-5` for ambiguous short titles.

**Prompt template:**
```
You are writing for a general audience — explain this Canadian federal bill in 2-3 sentences that a grandparent could understand. No legalese. Focus on what it actually does in practice.

Bill: {BillNumberFormatted} — {ShortTitleEn}
Full title: {LongTitleEn}
Type: {BillTypeEn}
Status: {CurrentStatusEn}
Introduced by: {SponsorEn}

Respond with only the plain-language summary. No preamble, no "This bill..." prefix needed.
```

**Cost estimate:** ~75–200 bills per session × 16 sessions = 1,200–3,200 bills total. At ~200 tokens/summary input + 100 tokens output: approximately $0.30–$0.80 total using Haiku. Well within budget.

### Anti-Patterns to Avoid

- **One request per ballot row:** Never fetch individual ballot data row-by-row. Always fetch the full division XML (one request = all ~338 MP votes for that division).
- **Matching MPs by name alone:** Two different MPs named "Paul Martin" exist in history. `PersonId` is the ground truth — match on PersonId + name, not name alone.
- **Generating bill summaries for every bill at ingestion time:** This is ~3,000 Claude API calls. Generate lazily on first view; batch pre-generation as a background job only after ingestion settles.
- **Using openparliament.ca API for bulk historical ingestion:** The rate limit (429) makes this impractical for 8,000 divisions. Use ourcommons.ca XML directly or the openparliament.ca PostgreSQL dump.
- **Storing the full XML as rawData:** VoteParticipant XML responses are ~200KB each. Store only key fields in `rawData` (same pattern as `international_aid`).

---

## Database Schema

### New Tables Required

```typescript
// packages/db/src/schema/parliament.ts

// Bills from LEGISinfo
export const parliamentBills = pgTable('parliament_bills', {
  id: text('id').primaryKey(),   // "{parliament}-{session}-{BillNumberFormatted}" e.g. "44-1-C-69"
  billNumber: text('bill_number').notNull(),          // "C-69"
  billNumberFormatted: text('bill_number_formatted').notNull(), // "C-69"
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  parlSessionCode: text('parl_session_code').notNull(), // "44-1"
  shortTitleEn: text('short_title_en'),
  shortTitleFr: text('short_title_fr'),
  longTitleEn: text('long_title_en'),
  longTitleFr: text('long_title_fr'),
  billTypeEn: text('bill_type_en'),                  // "Government Bill", "Private Member's Bill", etc.
  sponsorEn: text('sponsor_en'),
  currentStatusEn: text('current_status_en'),
  receivedRoyalAssentAt: timestamp('received_royal_assent_at', { withTimezone: true }),
  passedHouseThirdReadingAt: timestamp('passed_house_third_reading_at', { withTimezone: true }),
  legisInfoUrl: text('legis_info_url'),               // source link
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('parliament_bills_bill_number_idx').on(t.billNumber),
  index('parliament_bills_parl_session_idx').on(t.parlSessionCode),
  // pg_trgm search on bill_number_formatted for "search Bill C-69"
  index('parliament_bills_bill_number_gin_idx').using('gin', sql`${t.billNumberFormatted} gin_trgm_ops`),
])

// Division-level vote summaries (one row per division)
export const parliamentVotes = pgTable('parliament_votes', {
  id: text('id').primaryKey(),     // "{parliament}-{session}-{divisionNumber}" e.g. "44-1-377"
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  parlSessionCode: text('parl_session_code').notNull(),
  divisionNumber: integer('division_number').notNull(),
  voteDate: date('vote_date').notNull(),
  voteDateTime: timestamp('vote_date_time', { withTimezone: true }),
  subject: text('subject').notNull(),             // DecisionDivisionSubject
  resultName: text('result_name').notNull(),      // "Agreed To" / "Negatived"
  yeasTotal: integer('yeas_total').notNull().default(0),
  naysTotal: integer('nays_total').notNull().default(0),
  pairedTotal: integer('paired_total').notNull().default(0),
  documentTypeName: text('document_type_name'),   // "Legislative Process", "Supply", etc.
  billId: text('bill_id').references(() => parliamentBills.id), // nullable FK to bills
  billNumber: text('bill_number'),               // denormalized for fast queries
  sourceFileHash: text('source_file_hash'),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('parliament_votes_session_division_idx').on(t.parlSessionCode, t.divisionNumber),
  index('parliament_votes_vote_date_idx').on(t.voteDate),
  index('parliament_votes_bill_id_idx').on(t.billId),
])

// Individual MP ballot rows (1.8–2.4M rows total for full history)
export const parliamentVoteBallots = pgTable('parliament_vote_ballots', {
  id: text('id').primaryKey(),  // "{voteId}-{personId}" e.g. "44-1-377-89156"
  voteId: text('vote_id').notNull().references(() => parliamentVotes.id),
  personId: integer('person_id').notNull(),     // ourcommons.ca PersonId — stable per person
  entityId: uuid('entity_id'),                  // FK to entities.id — set after matching
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  divisionNumber: integer('division_number').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  constituency: text('constituency'),
  province: text('province'),
  caucusShortName: text('caucus_short_name'),   // "CPC", "LPC", "NDP", "BQ", "GPC", "IND"
  ballotValue: text('ballot_value').notNull(),  // "Yea", "Nay", "Paired"
  isYea: boolean('is_yea').notNull().default(false),
  isNay: boolean('is_nay').notNull().default(false),
  isPaired: boolean('is_paired').notNull().default(false),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('parliament_vote_ballots_vote_id_idx').on(t.voteId),
  index('parliament_vote_ballots_entity_id_idx').on(t.entityId),
  index('parliament_vote_ballots_person_id_idx').on(t.personId),
  index('parliament_vote_ballots_caucus_idx').on(t.caucusShortName),
  index('parliament_vote_ballots_ballot_value_idx').on(t.ballotValue),
])

// MP profiles — PersonId anchor for entity matching
export const mpProfiles = pgTable('mp_profiles', {
  personId: integer('person_id').primaryKey(),  // ourcommons.ca PersonId — stable across sessions
  entityId: uuid('entity_id'),                  // matched entity (may be null if unmatched)
  canonicalFirstName: text('canonical_first_name').notNull(),
  canonicalLastName: text('canonical_last_name').notNull(),
  normalizedName: text('normalized_name'),
  matchMethod: text('match_method'),            // 'deterministic', 'fuzzy', 'ai_verified', 'new_entity'
  matchConfidence: real('match_confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('mp_profiles_entity_id_idx').on(t.entityId),
  index('mp_profiles_normalized_name_idx').on(t.normalizedName),
])

// AI-generated bill summaries (parallel to ai_summaries for entities)
export const billSummaries = pgTable('bill_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: text('bill_id').notNull().references(() => parliamentBills.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  model: text('model').notNull(),              // 'claude-haiku-3-5' or 'claude-sonnet-4-5'
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  isStale: boolean('is_stale').notNull().default(false),
}, (t) => [
  uniqueIndex('bill_summaries_bill_id_idx').on(t.billId),
])
```

### Composite Primary Key Strategy

Use string composite IDs (consistent with existing `donations`, `contracts` patterns):
- `parliament_votes.id` = `"{parliament}-{session}-{divisionNumber}"` e.g. `"44-1-377"`
- `parliament_vote_ballots.id` = `"{parliament}-{session}-{divisionNumber}-{personId}"` e.g. `"44-1-377-89156"`
- `parliament_bills.id` = `"{parliament}-{session}-{billNumberFormatted}"` e.g. `"44-1-C-69"` (URL-safe)

### entity_connections extensions

Add new `connection_type` values to the existing `entity_connections` table:
- `mp_voted_yea_on_bill` — politician entity voted Yea on a bill (with bill reference in metadata)
- `mp_voted_nay_on_bill` — politician entity voted Nay on a bill

These connections enable the PARL-04 cross-reference: "MP voted for energy bill AND received donations from oil & gas donors."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML parsing | Custom regex/string parser | `fast-xml-parser` (already installed) | Already proven for IATI XML; handles BOM, attributes, nested arrays |
| MP name disambiguation | Custom fuzzy logic | Existing `findDeterministicMatch` + `findFuzzyMatches` + `verifyMatchWithAI` pipeline | Reuses the battle-tested entity matching stack |
| Bill plain-language summaries | Template-based summarizer | Claude Haiku via existing `@anthropic-ai/sdk` | 3,000 bills × 0.1¢ = trivial cost; quality far exceeds templates |
| Per-vote ballot fetching | Concurrent batch fetcher | Sequential with 100ms delay | No documented rate limit, but aggressive concurrency on government servers is bad practice |
| Historical data bulk load | Re-scraping all 16 sessions | openparliament.ca PostgreSQL dump as alternative | 1.2GB compressed dump exists, updated monthly — usable if XML scraping proves too slow |

**Key insight:** The entity matching pipeline cost zero additional development because MP names map to the existing deterministic → fuzzy → AI pipeline. The only new matching code needed is the `PersonId`-keyed `mp_profiles` table as a stable cross-session anchor.

---

## Common Pitfalls

### Pitfall 1: 37th Parliament XML Unavailability

**What goes wrong:** `ourcommons.ca/members/en/votes/xml?parlSession=37-1` returns HTTP 500. The 37th Parliament (January 2001 start) is the earliest LEGISinfo coverage, but the XML export endpoint may not serve it.

**Why it happens:** The XML export feature on ourcommons.ca appears to have been added after the 37th Parliament; older records may only exist in the HTML interface or not at all.

**How to avoid:** Start ingestion from the 38th Parliament (2004) as a confirmed baseline. For 37th Parliament data, check openparliament.ca API (which returns empty arrays for 37-1 as well) and the PostgreSQL dump. If no machine-readable source exists for the 37th Parliament, document this as a known gap with a note in the "How It Works" page.

**Warning signs:** HTTP 500 response (not 404 — 500 means server error, not missing resource; may intermittently work).

### Pitfall 2: Ballot Fetching Volume — HTTP Request Count

**What goes wrong:** Fetching individual MP ballots requires one HTTP request per division. For the 42nd Parliament alone (1,379 divisions), that is 1,379 requests. Full history = ~7,000 requests.

**Why it happens:** There is no bulk ballot download endpoint — each division must be fetched individually.

**How to avoid:** Use sequential fetching with a 100–200ms delay between requests. At 200ms per request, 7,000 requests = ~23 minutes — acceptable for a one-time historical backfill. Store a `ballots_ingested` boolean on `parliament_votes` to allow resumable ingestion.

**Warning signs:** HTTP 429 or connection refused after many sequential requests.

### Pitfall 3: Name Matching Across Eras — Different MPs, Same Name

**What goes wrong:** `PersonId` 12345 = "Paul Martin" (PM 2003–2006). `PersonId` 67890 = "Paul Martin" (MP for a riding from 2010). Both names normalize to the same string. Without the `PersonId` anchor, the matcher would merge their voting records.

**Why it happens:** Canada has had cases of MPs with identical names serving in different eras. The `entities` table uses `(canonical_name, entity_type)` as a unique constraint — two different "Paul Martin" politicians would be a conflict.

**How to avoid:** `mp_profiles.person_id` (integer) is the ground truth. When creating a new politician entity for an MP, include the PersonId in `rawData` and consider appending a disambiguation suffix (`"Paul Martin (2)"`) if a name collision is detected. The existing entity matching system's conservative AI prompt ("same name alone is NOT sufficient evidence") already guards against false positive merges.

**Warning signs:** `entity_matches_log` records with `decision = 'uncertain'` for politician names.

### Pitfall 4: BillNumberCode Missing for Non-Bill Votes

**What goes wrong:** Most votes are on motions, procedural matters, supply bills, etc. — not on numbered bills. The `BillNumberCode` field in the aggregate vote XML is empty for these. Blindly treating every vote as a bill vote will produce hundreds of null FK violations.

**Why it happens:** The House votes on far more than just bills — adjournment motions, committee reports, supply motions, opposition day motions.

**How to avoid:** `billId` on `parliament_votes` must be nullable. Only set it when `BillNumberCode` is non-empty and a matching record exists in `parliament_bills`. Log votes without bill linkage — they are still valid and searchable.

### Pitfall 5: Party Name Inconsistency Across Sessions

**What goes wrong:** `CaucusShortName` values change over time. "Conservative" became "CPC", "Alliance" merged with "PC", "Reform" preceded "Alliance". Historical ballot records will have party names that no longer exist.

**Why it happens:** Canadian political parties form, merge, rename, and dissolve. The XML records the party at the time of the vote.

**How to avoid:** Store `caucus_short_name` as-is from the source. Build a normalization map for display purposes (e.g., "Alliance" → "Canadian Alliance (now CPC)"). Do not try to retroactively re-map historical party affiliations to current parties — this is editorializing.

### Pitfall 6: fast-xml-parser isArray Configuration

**What goes wrong:** When a session has exactly one vote, `<ArrayOfVote>` contains a single `<Vote>` child. Without `isArray` config, fast-xml-parser parses this as an object, not an array — `(votes as VoteRecord[]).map(...)` throws at runtime.

**Why it happens:** XML to JS object mapping is ambiguous for single-element collections without explicit schema hints.

**How to avoid:** Always configure `isArray: (name) => ['Vote', 'VoteParticipant', 'MemberOfParliament'].includes(name)` in the XMLParser options — the same pattern used in `parsers/international-aid.ts`.

### Pitfall 7: Duplicate Bill IDs Across Sessions

**What goes wrong:** "Bill C-1" exists in every parliament as a pro forma bill. `parliament_bills.id` must include the parliament-session prefix, not just the bill number.

**Why it happens:** Bill numbers reset each parliament. "C-69" in the 42nd Parliament (environmental assessment) is completely different from any future "C-69".

**How to avoid:** The recommended composite PK `"{parliament}-{session}-{billNumberFormatted}"` handles this correctly. Never use `BillNumberFormatted` alone as a primary key.

---

## Code Examples

### Parsing ArrayOfVoteParticipant XML

```typescript
// Source: verified against live ourcommons.ca/members/en/votes/44/1/377/xml
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    ['Vote', 'VoteParticipant', 'MemberOfParliament'].includes(name),
  parseAttributeValue: false,
  trimValues: true,
})

export function parseVoteBallotsXml(xml: string, voteId: string): BallotRecord[] {
  const parsed = parser.parse(xml) as Record<string, unknown>
  const root = parsed['ArrayOfVoteParticipant'] as Record<string, unknown> | undefined
  if (!root) return []

  const participants = (root['VoteParticipant'] as unknown[]) ?? []
  return participants.map((p) => {
    const participant = p as Record<string, unknown>
    return {
      voteId,
      personId: Number(participant['PersonId']),
      firstName: String(participant['PersonOfficialFirstName'] ?? ''),
      lastName: String(participant['PersonOfficialLastName'] ?? ''),
      constituency: String(participant['ConstituencyName'] ?? ''),
      province: String(participant['ConstituencyProvinceTerritoryName'] ?? ''),
      caucusShortName: String(participant['CaucusShortName'] ?? ''),
      ballotValue: String(participant['VoteValueName'] ?? ''),
      isYea: String(participant['IsVoteYea']) === 'true',
      isNay: String(participant['IsVoteNay']) === 'true',
      isPaired: String(participant['IsVotePaired']) === 'true',
    }
  })
}
```

### Fetching Ballots for a Division

```typescript
// URL pattern verified against live ourcommons.ca endpoints
async function fetchVoteBallotsXml(
  parliament: number,
  session: number,
  divisionNumber: number,
): Promise<string> {
  const url = `https://www.ourcommons.ca/members/en/votes/${parliament}/${session}/${divisionNumber}/xml`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ballots for ${parliament}-${session} div ${divisionNumber}: ${response.status}`)
  }
  return response.text()
}
```

### Bill Summary Claude Prompt

```typescript
// Model: claude-haiku-3-5 for standard bills; claude-sonnet-4-5 for ambiguous short titles
function buildBillSummaryPrompt(bill: {
  billNumberFormatted: string
  shortTitleEn: string | null
  longTitleEn: string | null
  billTypeEn: string | null
  sponsorEn: string | null
  currentStatusEn: string | null
}): string {
  return `You are writing for a general audience — explain this Canadian federal bill in 2-3 sentences a grandparent could understand. No legalese. Focus on what it actually does in practice.

Bill: ${bill.billNumberFormatted}${bill.shortTitleEn ? ` — ${bill.shortTitleEn}` : ''}
Full title: ${bill.longTitleEn ?? 'Not available'}
Type: ${bill.billTypeEn ?? 'Unknown'}
Status: ${bill.currentStatusEn ?? 'Unknown'}
Introduced by: ${bill.sponsorEn ?? 'Unknown'}

Respond with only the plain-language summary. No preamble.`
}
```

### MP Entity Matching

```typescript
// Reuses existing deterministic + fuzzy + AI pipeline
// PersonId is the stable anchor — match once per person, reuse across all sessions
async function matchMpToEntity(mp: MpMember): Promise<string | null> {
  const fullName = `${mp.firstName} ${mp.lastName}`

  // Check mp_profiles cache first — avoid re-matching known MPs
  const cached = await db.select().from(mpProfiles)
    .where(eq(mpProfiles.personId, mp.personId)).limit(1)
  if (cached[0]?.entityId) return cached[0].entityId

  // 1. Deterministic: exact normalized name match
  const det = await findDeterministicMatch(fullName, 'parliament_vote_ballots', 'mp_name')
  if (det) {
    await upsertMpProfile(mp.personId, det.entityId, 'deterministic', det.confidenceScore)
    return det.entityId
  }

  // 2. Fuzzy: pg_trgm similarity > 0.60
  const candidates = await findFuzzyMatches(fullName)
  const highConf = candidates.find(c => c.isHighConfidence)
  if (highConf) {
    await upsertMpProfile(mp.personId, highConf.entityId, 'fuzzy', highConf.similarityScore)
    return highConf.entityId
  }

  // 3. Medium confidence: AI verification
  const medConf = candidates.find(c => !c.isHighConfidence)
  if (medConf) {
    const result = await verifyMatchWithAI(fullName, medConf.entityName,
      `MP from ${mp.constituency}, ${mp.province} (${mp.caucus})`,
      `Existing politician entity in GovTrace`)
    if (result.verdict === 'match') {
      await upsertMpProfile(mp.personId, medConf.entityId, 'ai_verified', result.confidence)
      return medConf.entityId
    }
  }

  // 4. New entity — create politician entry
  const entityId = await createNewEntity(fullName, 'parliament_vote_ballots', 'mp_name', 'politician')
  await upsertMpProfile(mp.personId, entityId, 'new_entity', 1.0)
  return entityId
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scrape HTML vote pages | XML endpoint at `/votes/{p}/{s}/{n}/xml` | Available since ~2011 (38th Parliament era) | Structured data, no HTML parsing needed |
| Manual per-session downloads | `parlSession` query parameter | Always available | Parameterized URL enables automation |
| Bill text from PDFs | LEGISinfo JSON API | API documented 2020+ | Structured bill metadata without PDF parsing |
| openparliament.ca as primary | ourcommons.ca XML as primary | openparliament.ca rate limits confirmed | Government source is more reliable and authoritative |

**Deprecated/outdated:**
- openparliament.ca CSV downloads: These do not appear to exist; the site only offers PostgreSQL dump.
- `parlSession=152` format: Seen in search results — this appears to be a legacy numeric session ID format. Use `parliament-session` format (e.g., `44-1`) which is confirmed working.

---

## Open Questions

1. **37th Parliament XML availability**
   - What we know: `parlSession=37-1` returns HTTP 500; openparliament.ca returns empty array for this session
   - What's unclear: Is this a permanent gap or an intermittent server error? Does the data exist in a different format?
   - Recommendation: Attempt at implementation time with retry logic. Document as "data starts from 38th Parliament (2004)" if consistently unavailable. Add a note to the How It Works page.

2. **PersonId stability guarantee across sessions for re-elected MPs**
   - What we know: PersonId appears in the `floorplan?personId=` URL pattern, suggesting it is stable per person. The Members XML shows PersonId alongside name+riding for each session.
   - What's unclear: Official documentation does not explicitly guarantee cross-session stability.
   - Recommendation: Treat as stable based on structural evidence. Build with `mp_profiles.person_id` as PK. If a collision is discovered at implementation, fall back to name+riding-based deduplication.

3. **Absent MPs — how are they recorded?**
   - What we know: The vote XML only includes MPs who voted. Paired MPs appear with `VoteValueName=Paired`. MPs who were simply absent are not listed.
   - What's unclear: Is there a way to infer absence vs. abstention from the data?
   - Recommendation: Store only what the data provides (Yea/Nay/Paired). Display absent as "Not recorded" in the UI — this is accurate and honest. Don't infer absence.

4. **How frequently is LEGISinfo JSON updated?**
   - What we know: It reflects current bill status in real time (bills show "Royal assent received" immediately).
   - What's unclear: Is there a changelog or version endpoint?
   - Recommendation: Re-fetch LEGISinfo JSON for current session bills on every weekly ingestion run. Historical session bills don't change (parliament is dissolved), so fetch once and mark as final.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All ingestion code | Yes | v24.13.0 | — |
| fast-xml-parser | XML parsing | Yes | 5.5.10 (catalog) | — |
| @anthropic-ai/sdk | Bill summaries | Yes | catalog | — |
| pg-boss | Job scheduling | Yes | catalog | — |
| ourcommons.ca/members/en/votes/xml | Aggregate vote data | Yes (confirmed) | Live | openparliament.ca dump |
| ourcommons.ca/members/en/votes/{p}/{s}/{n}/xml | Individual ballots | Yes (confirmed) | Live | openparliament.ca dump |
| parl.ca/legisinfo/en/bills/json | Bill metadata | Yes (confirmed) | Live | Manual LEGISinfo HTML scrape |

**Missing dependencies with no fallback:** None — all required services are available.

**Missing dependencies with fallback:** Historical ballot data for 37th Parliament — fallback is openparliament.ca PostgreSQL dump or noting the gap in documentation.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `apps/ingestion/vitest.config.ts` (or root) |
| Quick run command | `pnpm --filter @govtrace/ingestion test` |
| Full suite command | `pnpm --filter @govtrace/ingestion test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARL-01 | `parseVoteBallotsXml` extracts all VoteParticipant fields correctly | unit | `pnpm --filter @govtrace/ingestion test parsers/parliament-ballots` | Wave 0 |
| PARL-01 | `parseVotesXml` handles single-Vote XML without isArray errors | unit | `pnpm --filter @govtrace/ingestion test parsers/parliament-votes` | Wave 0 |
| PARL-01 | `parseBillsJson` extracts bill fields including nullable BillNumberCode | unit | `pnpm --filter @govtrace/ingestion test parsers/parliament-bills` | Wave 0 |
| PARL-02 | `mpProfiles` entity matching creates new politician entity for unknown MP | unit | existing matcher test patterns | extend existing |
| PARL-03 | Bill search returns results grouped by party | integration | manual on dev DB | manual |
| PARL-04 | AI summary prompt builds correct string from bill fields | unit | `pnpm --filter @govtrace/ingestion test runners/parliament` | Wave 0 |
| PARL-05 | Bill summary generation with Haiku returns plain-language text | integration | manual (live API) | manual |

### Wave 0 Gaps
- [ ] `apps/ingestion/src/parsers/parliament-votes.test.ts` — covers PARL-01 vote XML parsing with fixture
- [ ] `apps/ingestion/src/parsers/parliament-ballots.test.ts` — covers PARL-01 ballot XML parsing including single-element array edge case
- [ ] `apps/ingestion/src/parsers/parliament-bills.test.ts` — covers PARL-01 LEGISinfo JSON parsing
- [ ] `packages/db/src/schema/parliament.ts` — covers all 5 new tables

---

## Sources

### Primary (HIGH confidence)
- `https://www.ourcommons.ca/members/en/votes/xml?parlSession=44-1` — confirmed working, 928 divisions returned, XML structure verified
- `https://www.ourcommons.ca/members/en/votes/44/1/377/xml` — confirmed working, `ArrayOfVoteParticipant` structure with all fields verified
- `https://www.ourcommons.ca/members/en/search/xml?parlSession=44-1` — confirmed working, PersonId values verified, ~340 MPs returned
- `https://www.ourcommons.ca/members/en/votes/45/1/1` — vote detail HTML page structure verified
- `https://www.parl.ca/legisinfo/en/bills/json?parlsession=44-1` — confirmed working, JSON bill fields verified
- `https://api.openparliament.ca/votes/?format=json` — vote JSON structure verified, ballots_url field confirmed
- `https://api.openparliament.ca/votes/ballots/?vote=%2Fvotes%2F45-1%2F94%2F&format=json` — ballot fields confirmed: `vote_url`, `politician_url`, `ballot` ("Yes"/"No")
- Parliament session dates from `https://lop.parl.ca/sites/ParlInfo/default/en_CA/Parliament/parliamentsSessions` (via WebSearch cross-verification)

### Secondary (MEDIUM confidence)
- `https://openparliament.ca/data-download/` — PostgreSQL dump confirmed, ~1.2 GB compressed (data as of mid-2023)
- `https://openparliament.ca/api/` — rate limit behavior (429) documented, session coverage gaps confirmed by testing
- `https://www.ourcommons.ca/en/open-data` — XML-only format for vote listings documented

### Tertiary (LOW confidence)
- 37th Parliament session data coverage: assumed unavailable based on HTTP 500 from XML endpoint and empty openparliament.ca API results — not definitively confirmed

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md must be respected in all planning and implementation:

- **Package manager:** pnpm (not npm, not yarn)
- **No barrel files:** Direct imports from specific files — no `index.ts` re-exports
- **TypeScript strict mode:** All new schema and parser files must be TypeScript with explicit types
- **No `any` types:** Use `unknown` for CSV/XML rows at parsing boundaries; use Zod for type narrowing where needed
- **`for...of` over `.forEach()`:** Use `for...of` loops in ingestion parsers
- **`const` by default:** Only `let` when reassignment is needed
- **Error objects:** `throw new Error('message')` not `throw 'message'`
- **No `console.log` in production:** Remove debug logging before commit (informational `console.log` for ingestion progress is acceptable per existing runner patterns)
- **React patterns (web layer):** Function components, hooks at top level, semantic HTML, proper key props
- **GSD workflow enforcement:** All phase work goes through `/gsd:execute-phase` — no direct repo edits outside GSD workflow
- **Claude models:** `claude-haiku-3-5` for high-volume bill summaries; `claude-sonnet-4-5` only for ambiguous cases
- **Ultracite:** Run `npm exec -- ultracite fix` (or `pnpm exec ultracite fix`) before committing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified present in `package.json`; fast-xml-parser 5.5.10 confirmed installed
- Data source URLs: HIGH — all primary URLs tested against live government endpoints
- XML field names: HIGH — verified from live XML responses, not documentation
- Volume estimates: MEDIUM — calculated from sampled sessions (38th, 39th, 41st, 42nd, 44th, 45th confirmed); others extrapolated
- PersonId stability: MEDIUM — structurally evident, not officially documented
- 37th Parliament coverage: LOW — HTTP 500 from XML endpoint, empty from openparliament.ca API

**Research date:** 2026-04-04
**Valid until:** 2026-07-04 (90 days — government XML endpoints are stable; LEGISinfo JSON format changes infrequently)
