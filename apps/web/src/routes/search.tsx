import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { searchEntities } from '@/server-fns/search'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from '@/components/search/SearchFilters'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'

const SearchParamsSchema = z.object({
  q: z.string().default(''),
  type: z
    .enum(['all', 'politician', 'company', 'person', 'organization', 'department'])
    .default('all'),
  province: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().default(1),
})

export const Route = createFileRoute('/search')({
  head: () => ({
    meta: [{ title: 'Search | GovTrace' }],
  }),
  validateSearch: SearchParamsSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    type: search.type,
    province: search.province,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    page: search.page,
  }),
  loader: async ({ deps }) => {
    if (!deps.q) return { results: [], page: 1, pageSize: 20 }
    return searchEntities({
      data: {
        query: deps.q,
        type: deps.type,
        province: deps.province,
        dateFrom: deps.dateFrom,
        dateTo: deps.dateTo,
        page: deps.page,
      },
    })
  },
  component: SearchPage,
})

function SearchPage() {
  const { results, page, pageSize } = Route.useLoaderData()
  const { q, type, province, dateFrom, dateTo } = Route.useSearch()
  const navigate = Route.useNavigate()

  const updateFilter = (key: string, value: string | number | undefined) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value, page: 1 }) })

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">
      {/* Search bar at top */}
      <div className="mb-6">
        <SearchBar
          initialValue={q}
          onSearch={(newQ) => navigate({ search: (prev) => ({ ...prev, q: newQ, page: 1 }) })}
        />
      </div>

      {q && (
        <p className="mb-6 text-sm text-muted-foreground">
          Showing results for <span className="font-medium text-foreground">"{q}"</span>
        </p>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar filters */}
        <aside className="w-full shrink-0 lg:w-56">
          <SearchFilters
            currentType={type ?? 'all'}
            currentProvince={province}
            currentDateFrom={dateFrom}
            currentDateTo={dateTo}
            onTypeChange={(t) => updateFilter('type', t)}
            onProvinceChange={(p) => updateFilter('province', p)}
            onDateFromChange={(d) => updateFilter('dateFrom', d)}
            onDateToChange={(d) => updateFilter('dateTo', d)}
          />
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {results.length > 0 && (
            <div className="mb-3 flex justify-end">
              <DownloadCSVButton
                fetchAllRows={async () =>
                  results.map((r) => ({
                    name: r.canonicalName,
                    type: r.entityType,
                    province: r.province ?? '',
                    donations: r.counts.donations,
                    contracts: r.counts.contracts,
                    grants: r.counts.grants,
                    lobbying: r.counts.lobbying,
                  }))
                }
                filename={`govtrace-search-${q.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 40)}.csv`}
                columns={[
                  { key: 'name', header: 'Name' },
                  { key: 'type', header: 'Type' },
                  { key: 'province', header: 'Province' },
                  { key: 'donations', header: 'Donation Records' },
                  { key: 'contracts', header: 'Contract Records' },
                  { key: 'grants', header: 'Grant Records' },
                  { key: 'lobbying', header: 'Lobbying Records' },
                ]}
              />
            </div>
          )}
          <SearchResults results={results} />
        </div>
      </div>
    </main>
  )
}
