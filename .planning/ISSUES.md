# Known Issues — Phase 2 Cleanup

## Data Sources ✓ ALL WORKING

| Source | Records | Status |
|--------|---------|--------|
| Elections Canada donations | 4,398,661 | ✓ |
| Federal contracts | 499,819 | ✓ |
| Federal grants | 1,215,421 | ✓ |
| Lobby registrations | 168,645 | ✓ |
| Lobby communications | 359,251 | ✓ |
| **Entities** | **1,231,390** | ✓ |
| **TOTAL** | **6,641,797** | ✓ |

## UI Bugs to Fix

### 1. Entity profile tabs — data not showing in tab content
- Tabs render but data tables show empty or render in wrong position
- Likely client-side hydration issue with `useQuery` in DataTable components
- Server functions return correct data (verified via SQL)
- **Debug:** Check browser console for errors when clicking tabs on `/entity/:id` page

### 2. AI Summary not generating
- Shows "Summary not available" even with ANTHROPIC_API_KEY set
- `getOrGenerateSummary` server function may not be triggering
- **Debug:** Check if the server function is called on profile load, check for API errors in terminal

### 3. Entity stats counts show 0 for politicians on search results
- `getEntityCounts` was fixed to check `recipient_name` for politicians
- May need to verify the fix is working in the browser (was just deployed)

## Fixes Applied This Session

- [x] `.validator()` → `.inputValidator()` (TanStack Start v1.167 API)
- [x] `db.execute()` returns RowList not `{ rows }` (postgres-js driver)
- [x] Removed broken `createAPIFileRoute` files (not in TanStack Start v1.167)
- [x] FlagModal matchLogId prop threading (COMM-03)
- [x] QueryClient wired into router via `routerWithQueryClient`
- [x] `.env` + `envDir` + dotenv for ingestion CLI
- [x] Elections Canada: streaming ZIP extract + CSV parse for 2GB+ file
- [x] Contracts/Grants: streaming parsers for large CSVs
- [x] Lobby downloaders: correct ZIP URLs from lobbycanada.gc.ca
- [x] Lobby parsers: actual column names (REG_NUM_ENR, COMLOG_ID, etc.)
- [x] Extract PrimaryExport.csv from multi-file ZIPs
- [x] Batch dedup in all upsert functions (ON CONFLICT duplicate key fix)
- [x] Grants column aliases (recipient_operating_name, agreement_type)
- [x] Politicians show donations received (by recipient_name, not entity_id)
- [x] Bulk entity creation from all 5 sources via SQL
- [x] Monorepo restructured: apps/web + packages/db + packages/ingestion + Turborepo

## Next Steps

1. Fix entity profile tab rendering (most impactful UI bug)
2. Test AI summary generation with API key
3. Phase 3: Visualizations (D3.js graphs, Sankey, timeline)
4. Phase 4: Newsletter
