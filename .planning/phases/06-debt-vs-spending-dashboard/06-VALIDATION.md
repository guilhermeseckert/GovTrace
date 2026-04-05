# Phase 06 Validation Architecture

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Quick run command | `pnpm --filter @govtrace/ingestion test` |
| Full suite command | `pnpm --filter @govtrace/ingestion test` |

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| DEBT-01 | Dashboard shows national debt and total aid spending | visual | manual verify in browser |
| DEBT-01 | fiscal_snapshots table populated from Stats Canada CSV | integration | manual verify in DB |
| DEBT-02 | Timeline chart renders with election year markers | visual | manual verify in browser |
| DEBT-03 | Department breakdown shows top departments by aid spending | visual | manual verify in browser |
| DEBT-04 | All numbers link to source data | visual | manual verify in browser |

## Sampling Rate

- **Per task commit:** `pnpm --filter @govtrace/ingestion test`
- **Phase gate:** Dashboard renders with real data + all source links verified
