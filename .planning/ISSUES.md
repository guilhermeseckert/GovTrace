# Known Issues — Phase 2 Cleanup

## Data Sources Status

| Source | Download | Parse | Upsert | Records |
|--------|----------|-------|--------|---------|
| Elections Canada | ✓ streaming ZIP | ✓ multi-era headers | ✓ idempotent | 4.4M |
| Contracts | ✓ streaming | ✗ untested with real data | ✗ untested | 0 |
| Grants | ✓ streaming | ✗ untested with real data | ✗ untested | 0 |
| Lobby Registrations | ✓ ZIP download works | ✗ wrong column names | ✗ untested | 0 |
| Lobby Communications | ✓ ZIP download works | ✗ wrong column names | ✗ untested | 0 |

## Parser Column Mismatches

### Lobby Communications
**Actual CSV headers:** `COMLOG_ID, DPOH_LAST_NM_TCPD, DPOH_FIRST_NM_PRENOM_TCPD, DPOH_TITLE_TITRE_TCPD, BRANCH_UNIT_DIRECTION_SERVICE, OTHER_INSTITUTION_AUTRE, INSTITUTION`

### Lobby Registrations
**Actual CSV headers:** `REG_ID_ENR, BNF_TYPE, EN_BNF_NM_AN, FR_BNF_NM, STREET_RUE_1, STREET_RUE_2, CITY_VILLE, POST_CODE_POSTAL, PROV_STATE_PROV_ETAT, COUNTRY_PAYS`

**Both need:** Parser column alias maps rewritten to match actual government CSV schemas.

### Contracts & Grants
Downloads are slow (open.canada.ca). Parser column mappings likely also need verification against actual CSV headers once download completes.

## Web App Issues (Fixed)

- [x] `.validator()` → `.inputValidator()` (TanStack Start v1.167)
- [x] `db.execute()` returns RowList not `{ rows }` (postgres-js)
- [x] `createAPIFileRoute` doesn't exist — removed broken API route files
- [x] FlagModal matchLogId threading
- [x] QueryClient not wired into router
- [x] DATABASE_URL / .env not loaded
- [x] Vite envDir pointing to monorepo root

## Entity Matching

- Bulk SQL entity creation done (670K entities from donations)
- Full matching pipeline (normalize → fuzzy → AI) too slow for row-by-row — needs batch optimization
- Entity-to-donation linking UPDATE still running (4.4M rows)

## Pending

- Contracts/grants CSV headers need verification when download completes
- Lobby parsers need complete rewrite for actual column names
- API routes need proper pattern for TanStack Start v1.167 (server routes or middleware)
- AI summaries need ANTHROPIC_API_KEY to generate
