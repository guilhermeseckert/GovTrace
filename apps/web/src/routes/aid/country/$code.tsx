import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getCountryAidProjects } from '@/server-fns/dashboard'
import { getCountryName, getFlag } from '@/lib/country-codes'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/aid/country/$code')({
  loader: async ({ params }) => {
    const result = await getCountryAidProjects({
      data: { countryCode: params.code, pageSize: 25 },
    })
    if (result.total === 0) throw notFound()
    return { initial: result, code: params.code }
  },
  notFoundComponent: () => (
    <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Country not found</h1>
      <p className="mt-2 text-muted-foreground">
        No aid projects found for this country code. It may not be in the dataset yet.
      </p>
      <Link to="/dashboard" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </main>
  ),
  pendingComponent: () => (
    <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-8 space-y-6">
      <div className="h-5 w-32 rounded bg-muted animate-pulse" />
      <div className="h-10 w-80 rounded bg-muted animate-pulse" />
      <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      <div className="h-10 w-full rounded bg-muted animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  ),
  component: CountryDrillDownPage,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  '1': { label: 'Pipeline', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  '2': { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  '3': { label: 'Finalisation', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' },
  '4': { label: 'Closed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400' },
  '5': { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500' },
} as const

function getStatusConfig(status: string | null) {
  if (!status) return null
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? null
}

function getSourceUrl(rawData: unknown, id: string): string {
  const segments = id.split('-')
  if (segments.length >= 3) {
    const projectNumber = segments[segments.length - 1]
    if (projectNumber) {
      return `https://w05.international.gc.ca/projectbrowser-banqueprojets/project-projet/details/${projectNumber}`
    }
  }
  if (rawData && typeof rawData === 'object') {
    const d = rawData as Record<string, unknown>
    const url = d['source_url'] ?? d['sourceUrl'] ?? d['url']
    if (typeof url === 'string' && url.length > 0) return url
  }
  return 'https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad'
}

function formatCurrencyFull(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B CAD`
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M CAD`
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatAmountShort(amount: string | null): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function CountryDrillDownPage() {
  const { initial, code } = Route.useLoaderData()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PAGE_SIZE = 25

  // Debounce search input
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['country-aid-projects', code, debouncedSearch, page],
    queryFn: () =>
      getCountryAidProjects({
        data: {
          countryCode: code,
          search: debouncedSearch || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    initialData: page === 1 && !debouncedSearch ? initial : undefined,
    staleTime: 1000 * 60 * 5,
  })

  const countryName = getCountryName(code)
  const flag = getFlag(code)
  const title = flag ? `${flag} ${countryName}` : countryName
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <main id="main-content">
      {/* Header */}
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="mt-3 font-serif text-3xl text-primary-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/80">
            {data ? (
              <>
                {data.total.toLocaleString()} project{data.total !== 1 ? 's' : ''}
                {' · '}
                {formatCurrencyFull(data.totalCommittedCad)} committed
                {' · '}
                {formatCurrencyFull(data.totalDisbursedCad)} disbursed
              </>
            ) : (
              <>
                {initial.total.toLocaleString()} projects
                {' · '}
                {formatCurrencyFull(initial.totalCommittedCad)} committed
                {' · '}
                {formatCurrencyFull(initial.totalDisbursedCad)} disbursed
              </>
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by project title or implementer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.rows.length ? (
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? `No projects matching "${debouncedSearch}" in ${countryName}.`
              : `No aid projects found for ${countryName}.`}
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-md border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Project</th>
                    <th className="px-4 py-3 text-left font-medium">Implementer</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Committed</th>
                    <th className="px-4 py-3 text-right font-medium">Disbursed</th>
                    <th className="px-4 py-3 text-left font-medium">Start</th>
                    <th className="px-4 py-3 text-left font-medium">End</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((row) => {
                    const statusConfig = getStatusConfig(row.activityStatus)
                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span
                            className="block max-w-[280px] truncate font-medium"
                            title={row.projectTitle ?? ''}
                          >
                            {row.projectTitle ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="block max-w-[180px] truncate">
                            {row.implementerName ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {statusConfig ? (
                            <Badge className={`text-xs ${statusConfig.className}`}>
                              {statusConfig.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatAmountShort(row.totalCommittedCad)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatAmountShort(row.totalDisbursedCad)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {row.startDate ? String(row.startDate).slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {row.endDate ? String(row.endDate).slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={getSourceUrl(row.rawData, row.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="space-y-3 md:hidden">
              {data.rows.map((row) => {
                const statusConfig = getStatusConfig(row.activityStatus)
                return (
                  <div
                    key={row.id}
                    className="space-y-1.5 rounded-md border bg-card p-3 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="truncate font-medium">{row.projectTitle ?? '—'}</span>
                      <span className="ml-2 shrink-0 tabular-nums text-right">
                        {formatAmountShort(row.totalCommittedCad)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {row.implementerName ?? row.fundingDepartment ?? 'Global Affairs Canada'}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusConfig && (
                        <Badge className={`text-xs ${statusConfig.className}`}>
                          {statusConfig.label}
                        </Badge>
                      )}
                      {row.startDate && (
                        <span className="text-xs text-muted-foreground">
                          {String(row.startDate).slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <a
                      href={getSourceUrl(row.rawData, row.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> Source
                    </a>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of{' '}
                {data.total.toLocaleString()} projects
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Source attribution */}
        <div className="border-t pt-4">
          <a
            href="https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Source: Global Affairs Canada IATI Activity Files
          </a>
        </div>
      </div>
    </main>
  )
}
