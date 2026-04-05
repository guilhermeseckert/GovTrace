# Phase 05 Validation Architecture

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Quick run command | `pnpm --filter @govtrace/ingestion test` |
| Full suite command | `pnpm --filter @govtrace/ingestion test` |

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| INTL-01 | `parseIatiFile` extracts all key fields from sample XML | unit | `pnpm --filter @govtrace/ingestion test parsers/international-aid` |
| INTL-01 | BOM stripping works correctly | unit | part of parser test |
| INTL-01 | `#text` extraction from value elements with attributes | unit | part of parser test |
| INTL-01 | Negative transaction values included in sum | unit | part of parser test |
| INTL-02 | `run-matching.ts` SOURCE_CONFIGS includes `international_aid` | integration | manual verify |
| INTL-03 | `build-connections.ts` produces `aid_recipient_to_department` rows | integration | manual verify post-ingest |
| INTL-04 | Search count queries include international_aid | integration | manual verify in web |
| INTL-05 | How It Works page lists IATI as 6th data source | visual | manual verify in browser |

## Wave 0 Gaps

- [ ] `packages/ingestion/src/parsers/international-aid.test.ts` — unit tests for INTL-01
- [ ] XML fixture `__fixtures__/iati-sample.xml` — 2 activities covering edge cases

## Sampling Rate

- **Per task commit:** `pnpm --filter @govtrace/ingestion test`
- **Phase gate:** Full suite green + manual spot-check of 3 activities in DB
