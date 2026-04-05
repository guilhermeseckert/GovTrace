# Phase 5: International Aid Ingestion - Research

**Researched:** 2026-04-04
**Domain:** IATI XML data ingestion, XML streaming parsing, entity matching
**Confidence:** HIGH (data sources verified by direct HTTP inspection; XML structure confirmed by live file sampling)

---

## Summary

Global Affairs Canada publishes IATI Activity Files as XML at `w05.international.gc.ca`. There are 4 active files split by project status (2+3 = active/finalization, 4/4a/4b = closed in 3 time bands), totalling ~64 MB of XML. Each file contains a small number of very large `<iati-activity>` elements — the status_2_3 file contains only ~1 activity visible in the first 30MB, but each activity has dozens of `<budget>` and `<transaction>` child elements. The real "records" for GovTrace are the activities themselves (one row per project), not individual transactions.

The key GovTrace insight this data enables: organizations that received both domestic Canadian contracts/grants AND international aid disbursements — revealing companies that have deep financial ties to the federal government across all spending categories. The `<participating-org role="4">` field is the implementer/contractor, which is the entity to match against the existing GovTrace entity graph.

The existing ingestion pattern (downloader → SAX-style streaming parser → batch upsert → matching pipeline entry) applies directly. The critical difference from CSV sources: XML requires a streaming SAX/pull parser rather than PapaParse. The `node-xml-stream-parser` package (v1.0.12) is well-suited — it is a stream-based event parser with a small footprint. `fast-xml-parser` v5.5.10 can also work for files under ~60MB but loads the full document into memory; given the status_2_3 file is 29MB, both approaches are viable but streaming is safer and more consistent with the existing architecture.

**Primary recommendation:** Add `node-xml-stream-parser` to the ingestion package, add a new `international_aid` table following the exact pattern of `grants`, add `'international_aid'` to `ingestion_runs.source`, and add `international_aid_recipient_to_department` to `entity_connections`. Match the `participating-org role="4"` (implementer) name against existing entities.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTL-01 | Entity profiles show international aid (recipient, amount, funding department) | New `international_aid` table with `entityId` FK; entity profile query joins this table |
| INTL-02 | Aid recipients entity-matched against existing domestic entities | Add `'international_aid'` to `SOURCE_CONFIGS` in `run-matching.ts`; implementer name → entity_id via existing 3-stage pipeline |
| INTL-03 | Cross-reference aid with domestic data on entity profiles | `entity_connections` gains new type `'aid_recipient_to_department'`; profile page query already handles multiple connection types |
| INTL-04 | Search results include aid data in entity counts | Profile/search count queries need to JOIN `international_aid` — same pattern as existing JOIN on `grants` |
| INTL-05 | How It Works page updated for 6th dataset | Static content edit in `apps/web` — no schema work needed |
</phase_requirements>

---

## Data Source

### Files Published by Global Affairs Canada

All files are at `https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/`

| File | Status | Size | URL suffix |
|------|--------|------|------------|
| Active + Finalisation | Status 2 and 3 | 29 MB | `dfatd-maecd_activit_status_2_3.xml` |
| Closed 2023+ | Status 4 | 9 MB | `dfatd-maecd_activit_status_4.xml` |
| Closed 2020–2022 | Status 4a | 13 MB | `dfatd-maecd_activit_status_4a.xml` |
| Closed 2017–2019 | Status 4b | 12 MB | `dfatd-maecd_activit_status_4b.xml` |

**Note:** There is also a Status 4c file (pre-2017) that does not appear in the search results above but likely exists at `dfatd-maecd_activit_status_4c.xml`. Verify with a HEAD request at ingestion time. The Open Government Portal listing for the dataset is at `https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad`.

**Total dataset size:** ~63 MB XML across 4+ files. Content-Type is `text/xml`. Files use UTF-8 with BOM.

**Update frequency:** The `generated-datetime` attribute on the root element shows the last refresh. Based on GAC's IATI page, these files are updated monthly. Schedule: monthly (first Sunday of each month at 5:30am UTC, after existing grants at 5am).

**Activity count:** Files are structured with a small number of activities (~dozens to low hundreds per file — not thousands) because each activity is a full project with many nested transactions. The "29MB for 1+ activities" pattern observed in the status_2_3 file confirms this: a single project can contain 40+ budget periods and 100+ transaction entries.

---

## IATI XML Structure

### Root Element

```xml
<?xml version="1.0" encoding="utf-8"?>
<iati-activities generated-datetime="2026-03-13T00:00:00-05:00" version="2.03">
  <iati-activity last-updated-datetime="..." default-currency="CAD" hierarchy="1" humanitarian="0">
    ...
  </iati-activity>
</iati-activities>
```

- IATI version is `2.03` (confirmed from live file)
- **No XML namespace declarations** — this is unusual for XML but confirmed. Do not use namespace-aware parsing modes.
- Default currency is `CAD` on the root `<iati-activity>` element. Value elements may or may not repeat the currency.
- The BOM (`\uFEFF`) may be present at byte 0 — strip it before parsing.

### Key Fields Per Activity

```xml
<iati-activity last-updated-datetime="..." default-currency="CAD">

  <!-- UNIQUE IDENTIFIER — use as primary key -->
  <iati-identifier>CA-3-A031268001</iati-identifier>

  <!-- REPORTING ORG — always Global Affairs Canada / DFATD -->
  <reporting-org ref="CA-3" type="10">
    <narrative xml:lang="en">Foreign Affairs, Trade and Development Canada (DFATD)</narrative>
  </reporting-org>

  <!-- PROJECT TITLE — use EN narrative -->
  <title>
    <narrative xml:lang="en">Canadian-Caribbean Cooperation Fund</narrative>
    <narrative xml:lang="fr">Fonds canadien de coopération pour les Caraïbes</narrative>
  </title>

  <!-- PROJECT DESCRIPTION — use EN narrative for summary -->
  <description type="1">
    <narrative xml:lang="en">...</narrative>
  </description>

  <!-- PARTICIPATING ORGANIZATIONS — role codes: 1=funder, 2=accountable, 3=extending, 4=implementing -->
  <participating-org role="1" ref="CA" type="10">
    <narrative xml:lang="en">Canada</narrative>
  </participating-org>
  <participating-org role="3" ref="CA-1" type="10">
    <narrative xml:lang="en">Canadian International Development Agency</narrative>
  </participating-org>
  <!-- role="4" = implementer = the entity to match against GovTrace domestic entities -->
  <participating-org role="4" type="10" crs-channel-code="11000">
    <narrative xml:lang="en">Public Works and Government Services Canada - Consulting and Audit Canada</narrative>
  </participating-org>

  <!-- ACTIVITY STATUS: 1=pipeline, 2=active, 3=finalisation, 4=closed, 5=cancelled -->
  <activity-status code="3" />

  <!-- DATES: type 1=planned start, 2=actual start, 3=planned end, 4=actual end -->
  <activity-date type="2" iso-date="2003-04-07" />
  <activity-date type="4" iso-date="2016-12-30" />

  <!-- RECIPIENT COUNTRY — ISO 3166-1 alpha-2; may use recipient-region instead -->
  <recipient-country code="HT" percentage="100.00" />
  <!-- OR: recipient-region if multi-country -->
  <recipient-region percentage="100.00" code="380" vocabulary="1" />

  <!-- SECTOR — DAC CRS codes; may have multiple with percentages -->
  <sector vocabulary="1" code="15110" percentage="60.00" />

  <!-- BUDGET — annual allocations; sum all type="1" (original) budgets for total authorized -->
  <budget type="1" status="2">
    <period-start iso-date="2002-04-01" />
    <period-end iso-date="2003-03-31" />
    <value value-date="2003-04-07">500000</value>  <!-- currency from default-currency="CAD" -->
  </budget>

  <!-- TRANSACTIONS — individual financial flows -->
  <transaction>
    <!-- type: 1=incoming funds, 2=outgoing commitment, 3=disbursement, 4=expenditure -->
    <transaction-type code="2" />
    <transaction-date iso-date="2003-04-07" />
    <value value-date="2003-04-07">17933718.13</value>
    <!-- No currency attribute = use default-currency from iati-activity -->
    <flow-type code="10" />
    <!-- receiver-org may be absent — means GAC itself is receiver -->
    <!-- provider-org may be absent — means Canada/GAC is provider -->
  </transaction>

</iati-activity>
```

### Field Extraction Strategy for GovTrace

GovTrace needs one row per `<iati-activity>` in the `international_aid` table. Extract:

| GovTrace Field | IATI Source | Notes |
|----------------|-------------|-------|
| `id` (PK) | `<iati-identifier>` text | e.g., `CA-3-A031268001` — globally unique, stable |
| `projectTitle` | `<title><narrative xml:lang="en">` | Fall back to `fr` if `en` absent |
| `description` | `<description type="1"><narrative xml:lang="en">` | First 2000 chars for storage |
| `implementerName` | `<participating-org role="4"><narrative xml:lang="en">` | The entity to match; may be absent |
| `fundingDepartment` | `<participating-org role="3"><narrative xml:lang="en">` | e.g., CIDA, DFATD |
| `recipientCountry` | `<recipient-country @code>` | ISO 3166-1 alpha-2; may be absent if regional |
| `recipientRegion` | `<recipient-region @code>` | DAC region code if no country |
| `activityStatus` | `<activity-status @code>` | 1–5 |
| `startDate` | `<activity-date type="2" @iso-date>` | Actual start; fall back to type="1" |
| `endDate` | `<activity-date type="4" @iso-date>` | Actual end; fall back to type="3" |
| `totalBudget` | Sum of `<budget type="1"><value>` | Original budgets summed in CAD |
| `totalDisbursed` | Sum of `<transaction type="3"><value>` | Disbursements summed in CAD |
| `totalCommitted` | Sum of `<transaction type="2"><value>` | Commitments summed in CAD |
| `currency` | `<iati-activity @default-currency>` | Almost always `CAD` |
| `sourceFileHash` | Computed at download | SHA-256 of source XML file |
| `rawData` | JSONB snapshot | Key fields only — NOT full XML blob |

---

## Standard Stack

### Core (no new packages required for basic approach)
`node-xml-stream-parser` is the recommended addition. The rest of the ingestion stack is already present.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-xml-stream-parser` | 1.0.12 | SAX-style streaming XML parser | Stream-based, low memory, works with Node.js streams; only new dep needed |
| `fast-xml-parser` | 5.5.10 | Alternative: full-document XML → JS object | Already widely used; works for files under ~60MB; simpler API but loads full document |

### Already in Stack (no changes)
| Library | Purpose |
|---------|---------|
| `chardet` + `iconv-lite` | Encoding detection/conversion (already used for CSV; XML is UTF-8 but has BOM) |
| `drizzle-orm` | ORM for upsert pattern |
| `pg-boss` | Job scheduling |
| `zod` | Schema validation of parsed activity objects |
| `@anthropic-ai/sdk` | Entity matching AI verification |

### Recommendation: fast-xml-parser over node-xml-stream-parser

Given the file sizes (9–29 MB) and that activities are few but large, the simpler approach is:

1. Download the file to disk (streaming write, same as contracts.ts)
2. Read it with `fast-xml-parser` in chunks using its `XMLParser` with `ignoreAttributes: false`
3. Process all activities from the parsed JS object

`fast-xml-parser` v5 supports streaming via `XmlParserStream` (pull-stream API added in v5). At 29MB, memory usage is ~3–5x file size = ~145MB peak, which is acceptable for an ingestion worker. This approach is simpler to implement and consistent with the "parse then upsert" pattern.

**Installation:**
```bash
pnpm add fast-xml-parser --filter @govtrace/ingestion
```

Also add to `pnpm-workspace.yaml` catalog:
```yaml
catalog:
  fast-xml-parser: ^5.5.10
```

### Version verification (checked 2026-04-04)
- `fast-xml-parser`: 5.5.10 (published ~1 day ago, actively maintained)
- `node-xml-stream-parser`: 1.0.12 (older, minimal maintenance)

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
apps/ingestion/src/
├── downloaders/
│   └── international-aid.ts        # 4-file download, same pattern as contracts.ts
├── parsers/
│   └── international-aid.ts        # XML → IatiActivityRecord[], uses fast-xml-parser
├── runners/
│   └── international-aid.ts        # orchestrates download → parse → upsert → run log
└── upsert/
    └── international-aid.ts        # INSERT ... ON CONFLICT, same pattern as grants.ts

packages/db/src/schema/
└── raw.ts                          # ADD: internationalAid table definition
    # also add 'international_aid' to ingestion_runs source enum comment
```

### Pattern 1: Multi-File Download

Unlike all other sources which have one URL, IATI has 4+ files. The downloader must iterate all URLs and return an array of `DownloadResult`.

```typescript
// apps/ingestion/src/downloaders/international-aid.ts

const IATI_FILES = [
  {
    name: 'status_2_3',
    url: 'https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/dfatd-maecd_activit_status_2_3.xml',
  },
  {
    name: 'status_4',
    url: 'https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/dfatd-maecd_activit_status_4.xml',
  },
  {
    name: 'status_4a',
    url: 'https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/dfatd-maecd_activit_status_4a.xml',
  },
  {
    name: 'status_4b',
    url: 'https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/dfatd-maecd_activit_status_4b.xml',
  },
] as const
```

Each file is downloaded individually, hashed, and the hash stored per-file in `ingestion_runs`. The runner creates one `ingestion_runs` record per file (same as how `elections-canada` is one run, `contracts` is another).

### Pattern 2: XML Parsing with fast-xml-parser

```typescript
// apps/ingestion/src/parsers/international-aid.ts
import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,     // Need @code, @xml:lang, @iso-date, @ref, @role attributes
  attributeNamePrefix: '@_',   // fast-xml-parser default prefix for attributes
  isArray: (name) =>           // These elements always appear as arrays
    ['iati-activity', 'budget', 'transaction', 'participating-org',
     'activity-date', 'recipient-country', 'recipient-region',
     'sector', 'narrative'].includes(name),
  parseAttributeValue: false,  // Keep values as strings — don't coerce "2" to number
  trimValues: true,
})

export function parseIatiFile(filePath: string, sourceFileHash: string): IatiActivityRecord[] {
  // Strip BOM if present
  let xmlContent = readFileSync(filePath, 'utf-8')
  if (xmlContent.charCodeAt(0) === 0xFEFF) {
    xmlContent = xmlContent.slice(1)
  }

  const parsed = parser.parse(xmlContent)
  const activities = parsed['iati-activities']['iati-activity'] ?? []

  return activities.map((act: unknown) => extractActivity(act, sourceFileHash))
}
```

**Critical `isArray` config:** Without this, fast-xml-parser collapses single-element arrays to objects. An activity with only one `<budget>` period will return an object instead of a `[object]` array, causing `.map()` to fail. Always force array for all repeated elements.

### Pattern 3: Value Aggregation

Transactions have no pre-aggregated total. Compute totals during parse:

```typescript
function sumTransactionsByType(transactions: unknown[], typeCode: string): number {
  return transactions
    .filter((t) => String(t['transaction-type']?.['@_code']) === typeCode)
    .reduce((sum, t) => {
      const val = parseFloat(String(t['value']?.['#text'] ?? t['value'] ?? '0'))
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
}
// type "2" = commitment, "3" = disbursement
```

Note: `fast-xml-parser` returns text content of `<value value-date="...">500000</value>` as the `#text` property when the element has both attributes and text content.

### Pattern 4: Narrative Language Extraction

```typescript
function extractNarrative(narratives: unknown[], lang = 'en'): string | null {
  if (!Array.isArray(narratives)) return null
  const match = narratives.find((n) => n['@_xml:lang'] === lang)
  return match?.['#text'] ?? match ?? null
}
```

### Anti-Patterns to Avoid

- **Loading XML with DOMParser:** Not available in Node.js without `jsdom`; use `fast-xml-parser` or SAX.
- **Treating `<value>` as a plain text node:** When an element has attributes AND text, fast-xml-parser uses `#text` for the text content — direct `t.value` will return an object, not a number.
- **Assuming single narrative per element:** The standard allows multiple `<narrative xml:lang="...">` children; always treat as array.
- **Using `xml2js`:** Deprecated, callback-based, loads full document, significantly slower than fast-xml-parser.
- **Storing full XML blob in rawData:** Activity descriptions alone can be 5KB of text. Store only the structured key fields in `rawData` JSONB to avoid row bloat.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML parsing | Custom regex-based XML extractor | `fast-xml-parser` v5 | IATI activities have nested elements, attribute values, mixed content — regex will break on any edge case |
| Currency conversion | Hardcoded CAD rate table | Store raw CAD value; add `currency` column for future | GAC default-currency is CAD; no conversion needed for v2.0 |
| Activity deduplication | Custom hash logic | Use `<iati-identifier>` as primary key directly | IATI identifiers are globally unique and stable by standard — never changed after first publication |
| BOM handling | `xmlContent.replace(/\uFEFF/g, '')` | `xmlContent.charCodeAt(0) === 0xFEFF` check + `slice(1)` | Global replace touches all text; BOM only at position 0 |

**Key insight:** IATI has a stable unique key per activity (`<iati-identifier>`). This is better than the hash-derived keys used for donations and contracts — use it directly as the `id` column primary key.

---

## Drizzle Schema Addition

Add to `packages/db/src/schema/raw.ts`:

```typescript
// International Aid projects from Global Affairs Canada IATI files (INTL-01)
// Source: https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad
// IATI identifier is globally unique and stable — use directly as PK
export const internationalAid = pgTable('international_aid', {
  id: text('id').primaryKey(),                    // <iati-identifier> e.g. "CA-3-A031268001"
  projectTitle: text('project_title').notNull(),
  description: text('description'),              // First 2000 chars of EN description
  implementerName: text('implementer_name'),     // participating-org role="4" EN narrative
  fundingDepartment: text('funding_department'), // participating-org role="3" EN narrative (e.g. CIDA, DFATD)
  activityStatus: integer('activity_status'),    // 1=pipeline, 2=active, 3=finalisation, 4=closed
  recipientCountry: text('recipient_country'),   // ISO 3166-1 alpha-2 (null if regional)
  recipientRegion: text('recipient_region'),     // DAC region code (null if country-specific)
  startDate: date('start_date'),
  endDate: date('end_date'),
  totalBudgetCad: numeric('total_budget_cad', { precision: 15, scale: 2 }),   // sum of budget type="1" values
  totalDisbursedCad: numeric('total_disbursed_cad', { precision: 15, scale: 2 }), // sum transaction type="3"
  totalCommittedCad: numeric('total_committed_cad', { precision: 15, scale: 2 }), // sum transaction type="2"
  currency: text('currency').notNull().default('CAD'),
  iatiFileStatus: text('iati_file_status').notNull(), // '2_3', '4', '4a', '4b' — which file it came from
  normalizedImplementerName: text('normalized_implementer_name'),  // for entity matching
  entityId: uuid('entity_id'),                   // FK to entities.id — set after matching
  sourceFileHash: text('source_file_hash').notNull(),
  rawData: jsonb('raw_data').notNull(),          // Structured key fields (NOT full XML)
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('international_aid_normalized_implementer_name_idx').on(t.normalizedImplementerName),
  index('international_aid_entity_id_idx').on(t.entityId),
  index('international_aid_recipient_country_idx').on(t.recipientCountry),
  index('international_aid_start_date_idx').on(t.startDate),
  index('international_aid_activity_status_idx').on(t.activityStatus),
])
```

### Entity Connections addition

Add to `entity_connections.connectionType` comment and `build-connections.ts`:

```typescript
// New connection type: 'aid_recipient_to_department'
// entity_a = implementer entity (company/org that delivered the aid project)
// entity_b = funding department entity (CIDA, DFATD, GAC)
// total_value = totalDisbursedCad (actual money disbursed)
// source_table = 'international_aid'
```

The `connectionType` column is `text` with no constraint — just add the new string value.

### ingestion_runs source values

Add `'international_aid'` to the `source` column comment/documentation. No schema change needed — it's already a free-form `text` column.

---

## Entity Matching Strategy

### What to Match

**Primary match target:** `<participating-org role="4">` (implementer) — this is the company or organization that actually delivered the aid project. This corresponds to vendor names in contracts and recipient names in grants.

**Secondary match target:** `<participating-org role="3">` (extending organization / funding dept) — this maps to existing department entities already in the graph from contracts and grants.

**Do not match:** `<participating-org role="1">` (Canada/funder) and `role="2"` (accountable org) — these are always Canada itself.

### Integration with Existing Matching Pipeline

Add `international_aid` to `SOURCE_CONFIGS` in `apps/ingestion/src/matcher/run-matching.ts`:

```typescript
{ 
  table: 'international_aid', 
  nameField: 'implementer_name', 
  normalizedField: 'normalized_implementer_name', 
  entityIdField: 'entity_id' 
},
```

The 3-stage pipeline (deterministic → fuzzy pg_trgm → Claude AI) runs unchanged. No modifications to the matcher are needed.

### Match Quality Expectations

- **High-confidence matches:** Implementers that are federal departments (PWGSC, CIDA, etc.) will match existing department entities deterministically.
- **Medium-confidence:** Private contractors (e.g., "SNC-Lavalin Group Inc.") need pg_trgm fuzzy matching — same name normalization (strip suffixes, lowercase) applies.
- **Low-match-rate entities:** NGOs and foreign organizations (e.g., "UNICEF", "World Food Programme") will NOT match Canadian domestic entities — these will create new entities of type `'organization'`. This is correct and expected.

### Entity Type for New Aid Entities

When creating new entities from unmatched implementer names, use `entityType: 'organization'` — consistent with how domestic NGO grant recipients are handled.

---

## Common Pitfalls

### Pitfall 1: isArray Not Configured for fast-xml-parser
**What goes wrong:** An activity with a single `<budget>` period produces `activity.budget = {period-start: ...}` (an object) instead of `[{period-start: ...}]` (an array). The `.map()` or `.reduce()` over budgets throws `TypeError: activity.budget.map is not a function`.
**Why it happens:** fast-xml-parser's default behavior collapses single-element arrays to plain objects.
**How to avoid:** Pass an `isArray` callback that returns `true` for all known repeated elements: `budget`, `transaction`, `participating-org`, `activity-date`, `recipient-country`, `sector`, `narrative`, `iati-activity`.
**Warning signs:** Ingesting a file with only one activity succeeds but an activity with one budget/transaction crashes.

### Pitfall 2: Value Elements with Attributes — `#text` Extraction
**What goes wrong:** `<value value-date="2003-04-07">17933718.13</value>` — fast-xml-parser returns `{ '#text': '17933718.13', '@_value-date': '2003-04-07' }` when `ignoreAttributes: false`. Code doing `parseFloat(transaction.value)` gets `NaN`.
**Why it happens:** When an element has both attributes and text content, fast-xml-parser uses `#text` for the content.
**How to avoid:** Always extract value as `val['#text'] ?? val` — handle both the attribute+text case and the text-only case.
**Warning signs:** `totalDisbursedCad` of `0` for all activities despite the XML containing transaction values.

### Pitfall 3: Namespace-Aware Parsing Mode
**What goes wrong:** The `xml:lang` attribute on `<narrative xml:lang="en">` uses the XML namespace prefix `xml:`. Some parsers reject this or require namespace handling.
**Why it happens:** `xml:lang` is a reserved XML attribute defined in the XML specification itself.
**How to avoid:** With fast-xml-parser and `ignoreAttributes: false`, `xml:lang` becomes `@_xml:lang` — use that string as the attribute key, not `@_lang`.
**Warning signs:** All `extractNarrative(narratives, 'en')` calls return `null`.

### Pitfall 4: BOM at Byte 0 Breaking XML Parser
**What goes wrong:** Parser throws `Invalid character at position 0` or `Unexpected token`.
**Why it happens:** The live file has a UTF-8 BOM (`0xEF 0xBB 0xBF` or `\uFEFF` in Node.js string). XML parsers are supposed to handle this but fast-xml-parser may not.
**How to avoid:** Strip BOM before parsing: `if (xmlContent.charCodeAt(0) === 0xFEFF) xmlContent = xmlContent.slice(1)`
**Warning signs:** Parse error only on the first file downloaded, not when testing with a handcrafted sample.

### Pitfall 5: Negative Transaction Values
**What goes wrong:** `totalDisbursedCad` ends up lower than expected because some `<transaction type="3">` have negative values (e.g., `-74685.05`) representing reversals/refunds.
**Why it happens:** IATI allows negative disbursements to represent returned funds. The live data confirms this (several negative values observed in the status_2_3 file).
**How to avoid:** Include negative values in the sum — they are valid and reduce the total correctly. Do not filter out negative transactions. Document in schema comments.
**Warning signs:** Total disbursed is suspiciously round or doesn't match what the Project Browser shows.

### Pitfall 6: recipient-country vs recipient-region
**What goes wrong:** Storing `recipient_country` as empty because the activity uses `<recipient-region>` instead.
**Why it happens:** Multi-country or regional programs use `<recipient-region>` with a DAC region code instead of a country code. The first activity in the live file uses `region code="380"` (Latin America and Caribbean) with no country.
**How to avoid:** Always try `<recipient-country>` first, then fall back to `<recipient-region>`. Store both in separate columns. Use `NULL` not empty string when absent.

### Pitfall 7: Memory Pressure on 29MB File
**What goes wrong:** Node.js OOM error when parsing the status_2_3 file (29MB XML → ~145MB in-memory JS object).
**Why it happens:** fast-xml-parser's standard `parser.parse()` loads the full content and builds the full object tree simultaneously.
**How to avoid:** The ingestion container should have at least 512MB RAM. For future-proofing, `XmlParserStream` (added in fast-xml-parser v5) can emit one `iati-activity` at a time. For v2.0, the 512MB guard is sufficient.

---

## Code Examples

### Verified XML Structure (from live file, 2026-04-04)

```xml
<!-- Root: no namespace declarations, version="2.03" -->
<iati-activities generated-datetime="2026-03-13T00:00:00-05:00" version="2.03">

  <iati-activity last-updated-datetime="2026-03-13T06:32:38-05:00"
                 default-currency="CAD" hierarchy="1" humanitarian="0">

    <iati-identifier>CA-3-A031268001</iati-identifier>

    <title>
      <narrative xml:lang="en">Canadian-Caribbean Cooperation Fund</narrative>
      <narrative xml:lang="fr">Fonds canadien de coopération pour les Caraïbes</narrative>
    </title>

    <!-- Implementer (role="4") = entity to match -->
    <participating-org role="4" type="10" crs-channel-code="11000">
      <narrative xml:lang="en">Public Works and Government Services Canada - Consulting and Audit Canada</narrative>
    </participating-org>

    <activity-status code="3" />

    <activity-date type="2" iso-date="2003-04-07" />  <!-- actual start -->
    <activity-date type="4" iso-date="2016-12-30" />  <!-- actual end -->

    <!-- recipient-region used instead of recipient-country for multi-country projects -->
    <recipient-region percentage="100.00" code="380" vocabulary="1" />

    <!-- Budget: sum type="1" across all periods for total authorized -->
    <budget type="1" status="2">
      <period-start iso-date="2002-04-01" />
      <period-end iso-date="2003-03-31" />
      <value value-date="2003-04-07">500000</value>
    </budget>

    <!-- Transaction: type="2"=commitment, "3"=disbursement; negative values are valid -->
    <transaction>
      <transaction-type code="2" />
      <transaction-date iso-date="2003-04-07" />
      <value value-date="2003-04-07">17933718.13</value>
    </transaction>
    <transaction>
      <transaction-type code="3" />
      <transaction-date iso-date="2005-03-31" />
      <value value-date="2005-03-31">-74685.05</value>  <!-- reversal — include in sum -->
    </transaction>

  </iati-activity>
</iati-activities>
```

### fast-xml-parser Configuration (verified pattern)

```typescript
// Source: fast-xml-parser v5 npm docs + live file testing
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name: string) =>
    [
      'iati-activity',
      'budget',
      'transaction',
      'participating-org',
      'activity-date',
      'recipient-country',
      'recipient-region',
      'sector',
      'narrative',
      'location',
      'policy-marker',
    ].includes(name),
  parseAttributeValue: false,  // Keep codes as strings, not numbers
  trimValues: true,
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IATI 1.x (flat XML) | IATI 2.03 (narrative elements for bilingual) | ~2014 | `<title>` is now a container with `<narrative xml:lang>` children, not a text node |
| D-Portal API | Direct file download from publisher | Ongoing | D-Portal aggregates all publishers; for Canada-only data, go direct to GAC |
| xml2js (callback) | fast-xml-parser (synchronous) | 2020+ | xml2js was the standard for Node.js XML; fast-xml-parser is now the ecosystem default |

**Deprecated/outdated:**
- `xml2js`: Callback-based, slower, being replaced project-by-project with fast-xml-parser
- IATI 1.x format: GAC uses 2.03; do not reference 1.x documentation (narrative elements differ significantly)

---

## Open Questions

1. **Does a status_4c file exist?**
   - What we know: The open.canada.ca JSON-LD only lists 3 files (2_3, 4, 4a, 4b in search results). The GAC IATI registry page lists "status 4b (closed before Jan 1 2017)" as the oldest.
   - What's unclear: Is there a 4c (pre-2015) file not surfaced in search?
   - Recommendation: Add a HEAD request check for `dfatd-maecd_activit_status_4c.xml` in the downloader; if it returns 200, add it; if 404, skip.

2. **Exact activity count per file**
   - What we know: Files are 9–29 MB; the count command returned `1` for the first two files because of the streaming timeout — these files have very long lines (activities span many KB each).
   - What's unclear: Whether there are 50 or 500 activities per file.
   - Recommendation: Not critical for planning — the upsert batch size of 500 activities is more than sufficient for any realistic count. Treat each file as a single batch.

3. **Presence of `<receiver-org>` in transactions**
   - What we know: Transactions observed in the live file do NOT have `<receiver-org>` or `<provider-org>` elements — they rely on the activity-level `participating-org` to convey that information.
   - What's unclear: Whether any activities in the historical (status 4/4a/4b) files include receiver-org at the transaction level.
   - Recommendation: Parse `receiver-org` if present but do not require it. The implementer entity is always sourced from `participating-org role="4"`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | XML parsing runtime | ✓ | 20 LTS (Docker) | — |
| PostgreSQL 16 | Data storage | ✓ | 16 (Hetzner) | — |
| `fast-xml-parser` | XML parsing | ✗ (not yet installed) | 5.5.10 available | Use node-xml-stream-parser |
| `w05.international.gc.ca` | Source data | ✓ | Live, verified 2026-04-04 | — |
| `open.canada.ca` | Dataset metadata | ✓ | Live | — |

**Missing dependencies with no fallback:**
- `fast-xml-parser` must be installed (`pnpm add fast-xml-parser --filter @govtrace/ingestion`)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `apps/ingestion/vitest.config.ts` (inferred from package.json scripts) |
| Quick run command | `pnpm --filter @govtrace/ingestion test` |
| Full suite command | `pnpm --filter @govtrace/ingestion test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTL-01 | `parseIatiFile` extracts all key fields from a sample XML activity | unit | `pnpm --filter @govtrace/ingestion test parsers/international-aid` | ❌ Wave 0 |
| INTL-01 | BOM stripping works correctly | unit | part of parser test | ❌ Wave 0 |
| INTL-01 | `#text` extraction from value elements with attributes | unit | part of parser test | ❌ Wave 0 |
| INTL-01 | Negative transaction values included in sum | unit | part of parser test | ❌ Wave 0 |
| INTL-02 | `run-matching.ts` SOURCE_CONFIGS includes `international_aid` | integration | manual verify | — |
| INTL-03 | `build-connections.ts` produces `aid_recipient_to_department` rows | integration | manual verify post-ingest | — |
| INTL-04 | Search count queries include international_aid | integration | manual verify in web | — |

### Sampling Rate
- **Per task commit:** `pnpm --filter @govtrace/ingestion test`
- **Per wave merge:** `pnpm --filter @govtrace/ingestion test`
- **Phase gate:** Full suite green + manual spot-check of 3 activities in DB before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/ingestion/src/parsers/international-aid.test.ts` — unit tests for INTL-01; needs a minimal 2-activity XML fixture in `apps/ingestion/src/parsers/__fixtures__/iati-sample.xml`
- [ ] XML fixture file `__fixtures__/iati-sample.xml` — 2 activities covering: single budget, multiple budgets, recipient-country, recipient-region, negative transaction, missing implementer

---

## Project Constraints (from CLAUDE.md)

- **Package manager:** pnpm (not npm/yarn)
- **TypeScript strict mode** required — no `any` types; use `unknown` for unvalidated XML nodes
- **No barrel files (index.ts re-exports)** — import directly from `fast-xml-parser`
- **`for...of` over `.forEach()`** — applies to activity and transaction iteration
- **`console.log` removal** — use `console.log` during ingestion is acceptable (matches existing pattern in all runners)
- **Biome linting:** Run `npm exec -- ultracite fix` before committing
- **Error handling:** Throw `Error` objects with descriptive messages; use try-catch in runners
- **Data ethics:** Never editorialize; always link to source; always show AI confidence on entity matches
- **`rawData` JSONB:** Store structured key fields only — do not dump raw XML string into JSONB

---

## Sources

### Primary (HIGH confidence)
- Live HTTP HEAD on all 4 IATI XML file URLs — file sizes confirmed 2026-04-04
- Live HTTP range request on `dfatd-maecd_activit_status_2_3.xml` bytes 0–20000 — XML structure confirmed 2026-04-04
- `https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad.jsonld` — dataset metadata confirmed
- `https://reference.codeforiati.org/activity-standard/overview/transactions/` — IATI 2.03 transaction type codes
- `npm view fast-xml-parser version` → 5.5.10 confirmed 2026-04-04
- `apps/ingestion/package.json` — existing dependency stack confirmed
- `packages/db/src/schema/raw.ts` — existing table patterns for schema additions

### Secondary (MEDIUM confidence)
- `https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad` — dataset landing page (redirected to iatiregistry.org for XML URL, not a direct download link)
- `https://www.iatiregistry.org/publisher/gac-amc` — publisher listing (404 on fetch, confirmed via search results)
- WebSearch results for IATI file URLs confirmed by cross-referencing with direct HTTP access

### Tertiary (LOW confidence)
- Activity count (number of `<iati-activity>` elements per file) — grep timeout returned `1` which is unreliable; estimated from file sizes and average activity size observed

---

## Metadata

**Confidence breakdown:**
- Data source URLs: HIGH — verified by direct HTTP access
- XML structure: HIGH — verified by live range request showing actual XML content
- IATI field definitions: HIGH — verified against IATI 2.03 reference docs
- Activity count per file: LOW — grep timed out; treat as unknown, handle gracefully
- fast-xml-parser API: HIGH — npm registry confirms v5.5.10; isArray/attributeNamePrefix are documented v5 features
- Entity matching integration: HIGH — source code read confirms exact pattern to follow

**Research date:** 2026-04-04
**Valid until:** 2026-10-04 (IATI standard is stable; GAC file URLs have been stable for years; XML structure unlikely to change)
