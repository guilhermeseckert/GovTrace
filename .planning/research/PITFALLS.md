# Pitfalls Research

**Domain:** Canadian civic data / government transparency platform (GovTrace)
**Researched:** 2026-03-31
**Confidence:** HIGH (critical pitfalls), MEDIUM (integration gotchas), HIGH (data format issues)

---

## Critical Pitfalls

### Pitfall 1: False-Positive Entity Matches Connecting Wrong People

**What goes wrong:**
The entity matching pipeline incorrectly merges two distinct real-world entities — most commonly two individuals with the same name, or two companies with similar trading names — and the platform publicly displays connections that don't exist. "John Smith (donor)" and "John Smith (lobbyist)" get merged and someone's professional reputation is damaged. This is not hypothetical: sanctions screening systems see 95%+ false positive rates with naive name-matching.

**Why it happens:**
Name-only matching is inherently ambiguous. Canadian political donation records include minimal disambiguating fields — no SIN, no address in published data, no consistent company registration numbers. "CGI Group Inc." vs "CGI Inc." is genuinely hard to resolve without corroborating evidence. Developers under time pressure ship with thresholds that are too low, trusting AI confidence scores without adversarial testing.

**How to avoid:**
- Never merge entities on name similarity alone. Require corroborating evidence: postal code match, shared director name, same riding, consistent time period.
- Treat the match confidence thresholds as a _public-facing_ decision, not just a technical one. A 0.75 similarity score that's wrong 25% of the time is a defamation liability.
- For individuals specifically: require at least 2 corroborating fields before merging. Companies can tolerate lower thresholds than individuals.
- Build manual review UI into the pipeline before launch, not as an afterthought.
- Display AI reasoning publicly on every matched connection — this surfaces errors to users who know the truth.
- The "Flag an error" system is not optional; it is the primary defect recovery mechanism and must ship with the first public version.

**Warning signs:**
- Match pipeline reports >5% of individual merges at confidence 0.6–0.75 without corroboration
- Test queries for common Canadian names (Mohammed Ahmed, Wei Zhang, etc.) return obviously wrong connections
- No test suite asserting known-non-matching pairs remain unmerged

**Phase to address:** Data ingestion / entity matching pipeline (before any public-facing data is displayed)

---

### Pitfall 2: Non-Idempotent Ingestion Pipeline Creates Duplicate Records

**What goes wrong:**
The ingestion pipeline runs weekly (donations, lobbyist comms) or quarterly (contracts, grants). On the second run, records that already exist in the database get INSERT'd again, doubling counts. A donor who gave $500 now appears to have given $1,000. Contracts show inflated values. The corruption is silent — no errors thrown, dashboards look plausible.

**Why it happens:**
Elections Canada and open.canada.ca publish full historical datasets, not just deltas. A naive pipeline that truncates and re-inserts works correctly at first but destroys user-flagged corrections and entity_connections graph data on every run. An append-only pipeline without deduplication keys silently duplicates on retry.

**How to avoid:**
- Every source record needs a deterministic, stable primary key derived from source data (not auto-generated). For Elections Canada: hash of (contributor_name, amount, date, riding, recipient). For contracts: the government-assigned contract_id where available, otherwise a content hash.
- Use PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` (upsert) as the canonical write pattern — never bare INSERT, never TRUNCATE + INSERT.
- Never derive ingestion IDs from auto-increment. Derive them from source fields.
- The entity_connections pre-computed table must be rebuilt from scratch, not mutated incrementally, to avoid accumulating stale edges.
- Store a `last_ingested_at` and `source_file_hash` per dataset run; skip re-processing when hash is unchanged.

**Warning signs:**
- Total donation count grows faster than the weekly update cadence would explain
- Re-running the pipeline on the same file changes any counts
- No `ON CONFLICT` clause in any INSERT statement

**Phase to address:** Data ingestion pipeline, specifically the upsert and keying strategy before any production ingestion runs

---

### Pitfall 3: Elections Canada CSV Schema Changes Break Historical Ingestion

**What goes wrong:**
Elections Canada contribution data goes back to 2004. Column names, field ordering, data types, and value formats have changed across election cycles and regulatory changes (2004 Canada Elections Act, 2007 Federal Accountability Act changes, subsequent amendments). A parser written for 2019 data silently truncates or misreads 2006 data. The platform shows donors from 2019 but "mysteriously" has no data before 2011.

**Why it happens:**
Developers download the most recent file, write a parser that works, and assume the same schema applies to all historical files. Government data portals don't always document schema evolution; you discover it by looking at actual files.

**Why it specifically matters for GovTrace:**
The most interesting political money stories often require historical data — tracking a company's donations across multiple governments or before a contract was awarded years later. Incomplete historical data silently undermines the core value proposition.

**How to avoid:**
- Download all historical CSV files before writing any parser — inspect minimum 3 time periods (2004–2007, 2012–2015, 2020–present).
- Write schema detection logic that identifies column layout by inspecting the header row, not by assuming column position.
- Write schema version tests: load 5 rows from each distinct era, assert all expected fields are present and non-null.
- Build an ingestion audit report that shows record counts by year — a sudden zero or near-zero for any election year is a red flag.
- Store the raw source file alongside processed records for 90 days so schema bugs can be re-processed without re-downloading.

**Warning signs:**
- `records_ingested_by_year` report shows any election year with significantly fewer records than adjacent years
- Parsing code accesses CSV columns by index position rather than header name
- No automated test loading a pre-2010 Elections Canada file

**Phase to address:** Data ingestion phase, specifically the historical backfill before any UI work begins

---

### Pitfall 4: AI Entity Matching Costs Run Away During Backfill

**What goes wrong:**
The Claude API is used for medium-confidence matches (0.6–0.85). During the initial historical data load — 20 years of Elections Canada data with millions of donation records — the number of medium-confidence candidates explodes. At $3/million input tokens, a poorly scoped batch job against millions of records costs hundreds of dollars before anyone notices. Or the opposite: rate limits get hit and the backfill silently stalls for 24 hours.

**Why it happens:**
Developers scope Claude API usage against test datasets of thousands of records. Production historical backfill is millions. The fan-out of candidate pairs is not linear — it's roughly O(n²) for naive pair generation within a similarity band. No one budgets the initial load separately from ongoing weekly increments.

**How to avoid:**
- Always use the Claude Batch API for bulk matching — 50% cost reduction vs. synchronous, and it's designed for exactly this pattern. Batches complete within 1–24 hours; acceptable for a background pipeline.
- Cap the number of medium-confidence candidates per ingestion run. Run in stages: process one year of Elections Canada first, measure actual cost, then extrapolate.
- Never call the Claude API synchronously inside a tight loop over source records. Queue candidates → batch → process results.
- Implement a circuit breaker: if a batch job would submit >10,000 requests, require manual approval before submission.
- Cache API results permanently. A match verification result for ("CGI Group Inc.", "CGI Inc.") should never be re-requested.
- Set up Anthropic spend limits at the org level before the first production run.

**Warning signs:**
- Claude API calls happening synchronously during ingestion (check for `await anthropic.messages.create` inside a loop)
- No cost estimate written down before initiating any historical backfill
- Batch job submits all candidates at once rather than in bounded chunks

**Phase to address:** Entity matching pipeline design, before any production-scale data run

---

### Pitfall 5: Canadian Government CSV Files Have Inconsistent Encoding

**What goes wrong:**
Elections Canada and open.canada.ca files are bilingual — French content contains accented characters (é, è, ç, à, ô). Older files (pre-2015 era) are often ISO-8859-1 or Windows-1252, while newer files are UTF-8. Some files have a BOM (byte-order mark) at the start. A parser that assumes UTF-8 everywhere either throws on older files or silently produces garbled French strings ("MontrÃ©al" instead of "Montréal") that cause fuzzy matching to fail for Quebec-based entities specifically.

**Why it happens:**
Government data is published by multiple departments with different technical standards, and older files predate the push toward UTF-8. Developers test on a recent file that happens to be UTF-8 and never encounter the issue until ingesting historical data or a different department's file.

**Why it specifically matters:**
Quebecois companies and individuals are heavily represented in donation/lobbying data. Garbled French names break entity matching specifically for this cohort. The platform silently under-connects Quebec political money while working correctly for English-language entities.

**How to avoid:**
- Use `chardet` or equivalent byte-sniffing on every downloaded file before parsing. Never assume encoding.
- Strip BOM if present before feeding to CSV parser.
- Write an encoding test suite: load each source file, assert the word "Québec" or "Montréal" appears correctly (not garbled) in at least one record.
- Store the detected encoding in the ingestion audit log alongside the file hash.
- For the lobbyist registry specifically: user-entered registration content can be in either language and in any encoding the registrant's browser sent — treat it as potentially mixed.

**Warning signs:**
- Quebec ridings or company names contain `Ã` sequences in the database
- Ingestion code has `encoding='utf-8'` hard-coded without a detection fallback
- No test asserting correct French character rendering after ingestion

**Phase to address:** Data ingestion pipeline, alongside schema version testing

---

### Pitfall 6: Pre-Computed Graph Table Becomes Stale After Data Corrections

**What goes wrong:**
The `entity_connections` table is pre-computed for query performance. A user flags an incorrect entity merge (Pitfall 1). The incorrect merge is resolved. But the pre-computed connections table still reflects the old (wrong) merge, so the profile page continues showing the false connection until the next scheduled rebuild. Worse: if the rebuild is triggered by ingestion and the error was in a historical record that never re-ingests, the stale connection persists indefinitely.

**Why it happens:**
Pre-computed tables are built for read performance and developers treat them as caches — eventually consistent is acceptable. But for a platform where false connections are a legal and reputational risk, "eventually" is not acceptable. The flush/rebuild trigger logic is often incomplete at design time.

**How to avoid:**
- Treat the `entity_connections` table as a derived materialized view, not a standalone table. It must be invalidated and rebuilt whenever any of its source data changes.
- Implement an explicit invalidation signal: when a community flag results in an entity merge correction, mark all connections involving those entity IDs as `stale = true` and trigger an async rebuild.
- Never serve `stale = true` connections on profile pages. Return a "connections are being recalculated" state instead.
- The full graph rebuild job must be idempotent and testable in isolation.

**Warning signs:**
- No code path that writes to `entity_connections` after a flag is resolved
- Graph rebuild is only triggered by the ingestion pipeline, not by corrections
- No `stale` or `last_computed_at` column on entity_connections

**Phase to address:** Entity graph pre-computation design phase

---

### Pitfall 7: Lobbying Registry Data Has Systematic Naming Inconsistencies

**What goes wrong:**
The Office of the Commissioner of Lobbying data has a known structural problem: consultant lobbyists register on behalf of clients, and the same client company may appear under slightly different names across in-house registrations vs. consultant registrations. Additionally, any free-text field in the registry is in the registrant's language of choice and entered without controlled vocabulary. "The Mining Association of Canada" appears as "MAC", "Mining Association of Canada", and "Mining Association of Canada (MAC)" across different registrations.

**Why it happens:**
The lobby registry captures what registrants submit, with minimal validation. Unlike, say, a company registration number, there is no canonical identifier for lobbying subjects. Developers assume the official registry has clean, consistent data because it's a legal compliance system — it doesn't.

**How to avoid:**
- Do not treat lobbyist registry organization names as ground truth for entity identity. They are hints, not facts.
- Apply the full normalization pipeline (strip legal suffixes, expand abbreviations, lowercase) to lobbying subject names before fuzzy matching, just as for donation records.
- Build a known-variants dictionary seeded with common Canadian acronyms (MAC, CBA, CMA, BDC, etc.) and apply as a pre-processing step.
- When matching lobbyist subjects to donation donors, treat medium-confidence matches with extra skepticism — the naming divergence is systematic, not random error.

**Warning signs:**
- Normalization pipeline treats lobbying subject names differently from donation contributor names
- No acronym expansion step in the normalization logic
- Entity search for "Mining Association of Canada" returns zero lobbying records

**Phase to address:** Entity normalization design, before any cross-dataset matching begins

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-coding CSV column names by index position | Fast initial parser | Breaks silently on any schema change; errors appear as wrong data, not exceptions | Never — always parse by header name |
| Synchronous Claude API calls in ingestion loop | Simpler code | Costs 2x vs. Batch API; blocks on rate limits; no retry logic | Never in production ingestion |
| Single `entity_connections` rebuild per weekly ingestion | Simple trigger logic | Corrections from user flags don't propagate until next ingestion cycle | Acceptable if corrections trigger an independent rebuild signal |
| drizzle-kit push in production deployment | Faster deploys | Destructive; no audit trail; no rollback path | Development only — never production |
| Building UI before ingestion pipeline is validated | Visible progress, demos well | You won't know the data is wrong until users tell you | Never — data quality gates UI work |
| Assuming UTF-8 encoding for all government CSV files | Simpler parser | Silent data corruption for French-language records specifically | Never — always detect encoding |
| Running ingestion on a single Hetzner server without separate DB backups | Low ops burden | One disk failure or Coolify crash destroys all ingested data | Never — weekly automated DB backups minimum |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Elections Canada Open Data API | Polling the data portal URL directly; no change detection | Download file, hash it, compare to stored hash — only re-process if changed |
| Claude Batch API | Submitting all candidates at once; no rate on batch creation | Submit batches of ≤5,000 requests; poll for completion; store results before processing |
| Coolify + PostgreSQL | Exposing database port in Docker config; assuming Coolify manages firewall | Use Docker `expose:` not `ports:`; Docker bypasses UFW/Hetzner firewall — PostgreSQL must never be on a public port |
| Coolify database migration runs | Migration job exits 0 but shows "unhealthy" in dashboard | Run migrations as a `command:` override on startup, not a separate service; or accept the cosmetic "unhealthy" status |
| open.canada.ca proactive disclosure CSV | Quarterly file has department-specific schema quirks | Download and inspect one file per major department before writing shared parser |
| lobbycanada.gc.ca | No bulk export API; search pagination required | Use open.canada.ca dataset (d70ef2117...) which is the bulk CSV export; do not scrape the registry UI |
| Resend email | Sending newsletter without confirmed opt-in tracking | Track confirmation tokens in DB; Resend does not manage opt-in state — you do |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full pg_trgm similarity scan over all entity names | Search autocomplete takes 2–5 seconds | Create GIN index on normalized_name column; use `similarity()` with a `WHERE similarity > 0.3` threshold | With >100k entity records (likely at full data load) |
| Generating all candidate pairs for entity matching in memory | Ingestion worker OOM-kills | Stream candidates from DB in batches; never load all names into application memory | At ~50k entity names |
| Rebuilding full entity_connections graph synchronously during web request | Profile page timeout | Graph rebuild is always async; profile pages read from pre-computed table only | First time any entity has >50 connections |
| D3.js force-directed graph with all connections for a well-connected entity | Browser tab freezes | Cap graph nodes at 100–150; provide "show more" controls; use canvas renderer for large graphs | ~200+ nodes in the graph |
| JOINing across donations + contracts + grants + lobbying at query time | All search queries slow | entity_connections pre-computed table is mandatory, not optional | At ~1M source records across all tables |
| Running ingestion as a synchronous web request | Request timeout kills mid-ingest | Ingestion is always a background job (separate worker process); web layer only triggers and reports status | First file larger than ~50MB |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing PostgreSQL port via Docker `ports:` mapping | DB accessible from internet (Docker bypasses Hetzner firewall and UFW) | Use `expose:` only; connect internally via Docker network; never map 5432 to host |
| Storing Claude API key in `.env` committed to repo | API key leaked, uncontrolled spend | Use Coolify environment variable injection; rotate key immediately if accidentally committed |
| Showing unverified AI match reasoning verbatim | Prompt injection if government source data contains adversarial text | Sanitize all source data before use in prompts; render AI reasoning as escaped text, never raw HTML |
| No rate limiting on search endpoint | Bulk scraping of the entire entity database | Add request rate limiting per IP; search results are public but bulk access should be throttled |
| Community flag system without abuse prevention | Coordinated flagging to suppress true connections | Rate-limit flags per IP; require flags to be reviewed before any connection is removed from display |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing connections without explicit "no wrongdoing implied" disclaimer | Users infer guilt from proximity; legal and ethical liability | Persistent disclaimer on every connection display, every profile page — not just a footer |
| AI-generated summaries that use passive voice ("X was connected to Y") | Readers interpret this as editorial judgment | Summaries must use factual, source-attributed language: "According to Elections Canada, X donated $Y to Z on [date]" |
| Search returning zero results for partial company name | Users don't know if entity exists or is named differently | Return fuzzy suggestions ("Did you mean...?") on zero-result searches |
| Entity profile page showing raw government data field names | Non-experts don't know what "contributor_type_desc" means | Map all field names to plain English labels before display |
| Match confidence badge with no explanation tooltip | Users don't trust the data or misinterpret confidence score | Every confidence badge links to an explanation of what the score means and how it was calculated |
| Displaying dollar amounts without context (e.g., a $500 donation among $5M total) | Individual records feel more alarming than they are | Show amounts in context: "X's $500 donation represents 0.01% of [party]'s total funding from corporate donors" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Entity matching pipeline:** Shows correct results in demos against 1,000 records — verify against full 20-year Elections Canada dataset; common names will surface false positives at scale that never appeared in testing.
- [ ] **Ingestion pipeline:** Runs successfully once — verify it is idempotent by running twice on the same file and asserting record counts are identical.
- [ ] **French character encoding:** Profile pages render correctly for English companies — verify "Québec", "Montréal", "Côte-d'Ivoire Investments Inc." all display without garbled characters after ingestion.
- [ ] **Entity graph:** Looks correct for well-connected entities in dev — verify the graph renderer handles a node with 500+ connections without browser freeze (set limit and test the fallback).
- [ ] **AI summaries:** Generates readable text — verify summaries for entities with zero connections, entities with only one data source, and entities with conflicting data across sources.
- [ ] **Community flagging:** Flag button exists — verify that a submitted flag actually persists to the database, appears in a review queue, and that the review action correctly marks the connection as disputed.
- [ ] **Data freshness display:** Each record shows its source — verify the "last updated" timestamp reflects the most recent ingestion run, not the application deploy date.
- [ ] **Historical completeness:** Data loads for 2024 — verify record counts by year in a bar chart; any year with zero or near-zero records indicates a schema parsing failure.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False positive entity merge discovered after public launch | HIGH | Immediately mark connection as disputed (don't delete); notify affected parties if contactable; rebuild entity_connections for affected entities; publish correction notice |
| Duplicate records from non-idempotent ingestion | MEDIUM | Identify duplicate key pattern; write de-duplication migration; re-run with upsert logic; validate counts |
| Historical data missing due to schema parsing failure | MEDIUM | Files are still available on Elections Canada; re-download affected years; fix parser; re-ingest with upsert (idempotent) |
| Claude API bill spike from unthrottled batch | LOW-MEDIUM | Anthropic spend limits prevent catastrophic overage if set; cancel in-progress batch; review and re-scope candidate generation logic |
| PostgreSQL exposed to internet via Docker | HIGH | Immediately remove `ports:` mapping; cycle DB credentials; check Hetzner access logs for unauthorized connections; rotate all secrets |
| Drizzle migration applied with push in production | HIGH | Take immediate snapshot; reconstruct migration file from schema diff; apply as proper migration; never use push in production again |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| False positive entity merges | Data ingestion + entity matching | Run known non-match test suite; query common Canadian names; check Quebec-based entities specifically |
| Non-idempotent ingestion pipeline | Data ingestion pipeline design | Run pipeline twice on same source file; assert counts unchanged |
| Elections Canada schema changes | Historical data backfill | `records_by_year` audit report shows no zero-years; French characters render correctly |
| Claude API cost runaway | Entity matching pipeline | Cost estimate before backfill; circuit breaker implemented; Batch API used exclusively |
| CSV encoding issues | Data ingestion pipeline | French character test: "Montréal" in database exactly matches source |
| Pre-computed graph staleness | Entity graph pre-computation | Correction triggers rebuild; stale connections not served to users |
| Lobbying registry naming inconsistencies | Entity normalization design | Acronym expansion test: "MAC" resolves to same entity as "Mining Association of Canada" |
| Docker port exposure | Infrastructure / deployment setup | Port 5432 not reachable from outside Docker network; confirmed via Hetzner firewall scan |
| D3.js graph performance | Visualization phase | Test graph with 500-node entity; confirm no browser freeze; fallback fires |
| AI summary hallucination | AI summary generation phase | Summaries contain only claims verifiable in source data; no passive assertions of connection |

---

## Sources

- [OpenSecrets uses AWS to transform political transparency through enhanced data matching](https://aws.amazon.com/blogs/publicsector/opensecrets-uses-aws-to-transform-political-transparency-through-enhanced-data-matching/) — Key lesson: start deterministic, not ML; don't wait for perfection; iterate
- [Transparency is Insufficient: Lessons from Civic Technology for Anticorruption — Harvard Ash Center](https://ash.harvard.edu/articles/transparency-is-insufficient-lessons-from-civic-technology-for-anticorruption/) — "Build it and they shall come" fails; design for the non-expert user first
- [I Self-Hosted 4 Projects on Hetzner + Coolify — what nobody tells you](https://ceaksan.com/en/hetzner-coolify-self-hosting-reality) — Docker bypasses Hetzner firewall; 11 critical CVEs in January 2026; build cache invalidation bugs
- [The IJF Lobbying Databases Methodology](https://theijf.org/lobbying-databases-methodology) — Systematic naming inconsistencies in Canadian lobbying registries documented
- [Multilingual Datasets: the Government of Canada approach — CKAN Wiki](https://github.com/ckan/ckan/wiki/Multilingual-Datasets,-the-Government-of-Canada-approach) — ISO-8859-1 common in older Canadian government CSV files
- [Claude Batch Processing — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing) — 50% cost reduction; 29-day result retention; batch + prompt caching can be combined
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff) — Never use drizzle push in production; manual migration history modification is dangerous
- [Reduce False Positives & Enhance Entity Resolution — LexisNexis Risk](https://risk.lexisnexis.com/insights-resources/article/entity-resolution-redefining-false-positive-problem) — 95%+ false positive rates common with name-only matching
- [Idempotency in Data Pipelines — Airbyte](https://airbyte.com/data-engineering-resources/idempotency-in-data-pipelines) — Blind append is the most common cause of data inflation in ingestion pipelines
- [Fuzzy Search with PostgreSQL Trigrams — Medium](https://medium.com/@vinodjagwani/fuzzy-search-with-postgresql-trigrams-smarter-matching-beyond-like-bce2bd3c4548) — GIN index required at millions of records; GiST faster to build but slower to query
- [Working with Data and Structured APIs — Open Government Canada](https://open.canada.ca/en/working-data-api/structured-data) — Official encoding guidance; French extended characters require ISO-8859-1 or UTF-8 detection

---

*Pitfalls research for: Canadian civic data / government transparency platform*
*Researched: 2026-03-31*
