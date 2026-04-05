# Phase 07 Validation Architecture

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Quick run command | `pnpm --filter @govtrace/ingestion test` |
| Full suite command | `pnpm --filter @govtrace/ingestion test` |

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| PARL-01 | `parseVoteBallotsXml` extracts VoteParticipant fields | unit | `pnpm --filter @govtrace/ingestion test parsers/parliament-ballots` |
| PARL-01 | `parseVotesXml` handles single-Vote XML without isArray errors | unit | `pnpm --filter @govtrace/ingestion test parsers/parliament-votes` |
| PARL-01 | `parseBillsJson` extracts bill fields including nullable BillNumberCode | unit | `pnpm --filter @govtrace/ingestion test parsers/parliament-bills` |
| PARL-02 | Votes tab displays on politician profiles | visual | manual verify in browser |
| PARL-03 | Bill search returns results grouped by party | integration | manual on dev DB |
| PARL-04 | AI summary includes voting pattern insights | integration | manual verify |
| PARL-05 | Bill summary generation produces plain-language text | integration | manual (live API) |

## Wave 0 Gaps

- [ ] `apps/ingestion/src/parsers/parliament-votes.test.ts` — vote XML parsing with fixture
- [ ] `apps/ingestion/src/parsers/parliament-ballots.test.ts` — ballot XML parsing including single-element array edge case
- [ ] `apps/ingestion/src/parsers/parliament-bills.test.ts` — LEGISinfo JSON parsing

## Sampling Rate

- **Per task commit:** `pnpm --filter @govtrace/ingestion test`
- **Phase gate:** Full suite green + manual spot-check of 3 bills in DB
