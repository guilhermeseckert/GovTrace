import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { searchEntities } from '@/server-fns/search'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from '@/components/search/SearchFilters'

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
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <SearchBar
          initialValue={q}
          onSearch={(newQ) => navigate({ search: (prev) => ({ ...prev, q: newQ, page: 1 }) })}
        />
      </div>
      <div className="flex flex-col gap-8 md:flex-row">
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
        <div className="flex-1">
          <SearchResults results={results} />
        </div>
      </div>
    </main>
  )
}
