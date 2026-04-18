import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Newspaper,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  Building2,
  DollarSign,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getNews,
  getNewsStats,
  getDepartmentListForNews,
  getEntityCrossReferences,
} from '@/server-fns/news'
import type { PressReleaseRow, EntityCrossRef } from '@/server-fns/news'
import { DataFreshness } from '@/components/dashboard/DataFreshness'

export const Route = createFileRoute('/news')({
  head: () => ({
    meta: [{ title: 'News | GovTrace' }],
  }),
  component: NewsPage,
})

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function truncateSummary(text: string | null, maxLen = 220): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen).trim()}...`
}

// ──────────────────────────────────────────────────────────────────────────────
// ContentTypeBadge
// ──────────────────────────────────────────────────────────────────────────────

const CONTENT_TYPE_COLORS: Record<string, string> = {
  'news releases': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  statements: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'media advisories': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  readouts: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  speeches: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  backgrounders: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

function ContentTypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const colorClass = CONTENT_TYPE_COLORS[type.toLowerCase()] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {type}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// EntityCrossRefsPanel — lazy-loaded when a card is expanded
// ──────────────────────────────────────────────────────────────────────────────

function EntityCrossRefsPanel({ pressReleaseId }: { pressReleaseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['news-entity-cross-refs', pressReleaseId],
    queryFn: () => getEntityCrossReferences({ data: { pressReleaseId } }),
    staleTime: 1000 * 60 * 10,
  })

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 pb-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  const refs = data?.entities ?? []

  if (refs.length === 0) {
    return (
      <p className="px-4 pb-4 text-sm text-muted-foreground italic">
        No GovTrace connections found for entities in this announcement.
      </p>
    )
  }

  return (
    <div className="px-4 pb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        GovTrace Entity Connections
      </p>
      <div className="space-y-2">
        {refs.map((ref) => (
          <EntityConnectionCard key={ref.entityId} ref={ref} />
        ))}
      </div>
    </div>
  )
}

function EntityConnectionCard({ ref }: { ref: EntityCrossRef }) {
  const hasAnyConnection =
    ref.connections.donations > 0 || ref.connections.lobbying > 0 || ref.connections.contracts > 0

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-sm">
          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Link
            to="/entity/$id"
            params={{ id: ref.entityId }}
            className="hover:underline text-primary"
          >
            {ref.name}
          </Link>
          <Badge variant="outline" className="text-xs capitalize">
            {ref.type}
          </Badge>
        </div>
        {!hasAnyConnection && (
          <span className="text-xs text-muted-foreground italic">No cross-references found</span>
        )}
      </div>
      {hasAnyConnection && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {ref.connections.donations > 0 && (
            <span>
              <span className="font-semibold text-foreground">{ref.connections.donations.toLocaleString()}</span>{' '}
              donation{ref.connections.donations !== 1 ? 's' : ''}
            </span>
          )}
          {ref.connections.lobbying > 0 && (
            <span>
              <span className="font-semibold text-foreground">{ref.connections.lobbying.toLocaleString()}</span>{' '}
              lobbying link{ref.connections.lobbying !== 1 ? 's' : ''}
            </span>
          )}
          {ref.connections.contracts > 0 && (
            <span>
              <span className="font-semibold text-foreground">{ref.connections.contracts.toLocaleString()}</span>{' '}
              contract{ref.connections.contracts !== 1 ? 's' : ''}
            </span>
          )}
          {ref.connections.totalValue > 0 && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="h-3 w-3" />
              <span className="font-semibold text-foreground">
                {ref.connections.totalValue >= 1_000_000
                  ? `${(ref.connections.totalValue / 1_000_000).toFixed(1)}M`
                  : ref.connections.totalValue.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
                }
              </span>
              {' '}total
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// PressReleaseCard
// ──────────────────────────────────────────────────────────────────────────────

function PressReleaseCard({ release }: { release: PressReleaseRow }) {
  const [expanded, setExpanded] = useState(false)

  const ministers = release.ministers ?? []
  const mentionedEntities = (release.mentionedEntities ?? []) as Array<{
    name: string
    type: string
    entityId?: string
    confidence: string
  }>
  const dollarAmounts = (release.dollarAmounts ?? []) as Array<{ amount: string; context: string }>
  const hasEntityConnections = mentionedEntities.some((e) => e.entityId)

  // Build a plain-English story for the grandpa test
  const ministerCount = ministers.length
  const hasMinistersText = ministerCount > 0
    ? `Minister${ministerCount > 1 ? 's' : ''} ${ministers.slice(0, 2).join(' and ')}${ministerCount > 2 ? ` and ${ministerCount - 2} other${ministerCount - 2 > 1 ? 's' : ''}` : ''} involved.`
    : null
  const hasDollarText = dollarAmounts.length > 0
    ? `Mentions ${dollarAmounts.length} dollar figure${dollarAmounts.length > 1 ? 's' : ''} including ${dollarAmounts[0]?.amount ?? ''}.`
    : null

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Title + external link */}
          <div className="flex flex-wrap items-start gap-2">
            <span className="font-medium leading-snug">{release.title}</span>
            <a
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open "${release.title}" on canada.ca`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Meta row: date, department, content type */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(release.publishedDate)}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {release.department}
            </span>
            <ContentTypeBadge type={release.contentType} />
          </div>

          {/* Plain-English summary (grandpa test) */}
          {release.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {truncateSummary(release.summary)}
            </p>
          )}

          {/* Story sentence */}
          {(hasMinistersText ?? hasDollarText) && (
            <p className="text-sm text-foreground/70">
              {[hasMinistersText, hasDollarText].filter(Boolean).join(' ')}
            </p>
          )}

          {/* Minister badges */}
          {ministers.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {ministers.map((minister) => {
                const matched = mentionedEntities.find(
                  (e) => e.name === minister && e.entityId,
                )
                return matched?.entityId ? (
                  <Link
                    key={minister}
                    to="/entity/$id"
                    params={{ id: matched.entityId }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge variant="secondary" className="cursor-pointer text-xs hover:bg-primary/10">
                      <User className="mr-1 h-2.5 w-2.5" />
                      {minister}
                    </Badge>
                  </Link>
                ) : (
                  <Badge key={minister} variant="outline" className="text-xs">
                    <User className="mr-1 h-2.5 w-2.5" />
                    {minister}
                  </Badge>
                )
              })}
            </div>
          )}

          {/* Dollar amount badges */}
          {dollarAmounts.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {dollarAmounts.slice(0, 5).map((da, idx) => (
                <Badge
                  key={`${da.amount}-${String(idx)}`}
                  variant="secondary"
                  className="text-xs bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                  title={da.context}
                >
                  <DollarSign className="mr-0.5 h-2.5 w-2.5" />
                  {da.amount}
                </Badge>
              ))}
            </div>
          )}

          {/* Hint about connections */}
          {hasEntityConnections && !expanded && (
            <p className="text-xs text-primary/70 italic">
              Click to see GovTrace connections for entities in this announcement.
            </p>
          )}
        </div>
      </button>

      {expanded && <EntityCrossRefsPanel pressReleaseId={release.id} />}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// NewsStats (hero banner)
// ──────────────────────────────────────────────────────────────────────────────

function NewsStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['news-stats'],
    queryFn: () => getNewsStats(),
    staleTime: 1000 * 60 * 60,
  })

  const stats = [
    {
      label: 'Total announcements',
      value: isLoading ? null : String(data?.total.toLocaleString() ?? '0'),
      icon: Newspaper,
    },
    {
      label: 'Departments',
      value: isLoading ? null : String(data?.departments.toLocaleString() ?? '0'),
      icon: Building2,
    },
    {
      label: 'Latest release',
      value: isLoading ? null : (data?.latestDate ? formatDate(data.latestDate) : '—'),
      icon: Calendar,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
          {value === null ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <p className="text-lg font-semibold leading-tight">{value}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// NewsPage
// ──────────────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  'news releases',
  'statements',
  'media advisories',
  'readouts',
  'speeches',
  'backgrounders',
]

function NewsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [contentType, setContentType] = useState('')
  const PAGE_SIZE = 25

  const { data: departments } = useQuery({
    queryKey: ['news-departments'],
    queryFn: () => getDepartmentListForNews(),
    staleTime: 1000 * 60 * 60,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['news', page, search, department, contentType],
    queryFn: () =>
      getNews({
        data: {
          page,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          department: department || undefined,
          contentType: contentType || undefined,
        },
      }),
    staleTime: 1000 * 60 * 5,
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = String(formData.get('q') ?? '').trim()
    setSearch(q)
    setPage(1)
  }

  function handleDepartmentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDepartment(e.target.value)
    setPage(1)
  }

  function handleContentTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setContentType(e.target.value)
    setPage(1)
  }

  const hasFilters = !!(search || department || contentType)

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-normal tracking-tight">Government News</h1>
        <p className="max-w-2xl text-muted-foreground">
          Federal press releases, statements, and media advisories from all departments.
          Expand any announcement to see connections to lobbying, contracts, and donations
          in the GovTrace database.
        </p>
      </div>

      {/* Stats */}
      <NewsStats />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              type="search"
              placeholder="Search announcements..."
              defaultValue={search}
              className="h-9 w-48 rounded-md border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Search announcement titles"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-9">
            Search
          </Button>
        </form>

        <select
          value={department}
          onChange={handleDepartmentChange}
          className="h-9 max-w-[200px] rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {(departments ?? []).map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        <select
          value={contentType}
          onChange={handleContentTypeChange}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by content type"
        >
          <option value="">All types</option>
          {CONTENT_TYPES.map((ct) => (
            <option key={ct} value={ct}>
              {ct.charAt(0).toUpperCase() + ct.slice(1)}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setDepartment('')
              setContentType('')
              setPage(1)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total.toLocaleString()} announcement{data.total !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
          {department && ` from ${department}`}
          {contentType && ` — ${contentType}`}
        </p>
      )}

      {/* Press release list */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={String(i)} className="h-24 w-full" />
            ))}
          </div>
        ) : data?.rows.length === 0 ? (
          <div className="p-10 text-center">
            <Newspaper className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            {hasFilters ? (
              <>
                <p className="text-sm font-medium text-foreground">No announcements match your filters</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try broadening your search, clearing the department, or changing the content type filter.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No press releases ingested yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Press releases and government announcements are updated daily from canada.ca.
                  Check back after the next scheduled ingestion run.
                </p>
              </>
            )}
          </div>
        ) : (
          <div>
            {(data?.rows ?? []).map((release) => (
              <PressReleaseCard key={release.id} release={release} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {String(page)} of {String(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Data freshness */}
      <DataFreshness sources={['news']} />

      {/* Source note */}
      <p className="text-xs text-muted-foreground">
        Sources:{' '}
        <a
          href="https://www.canada.ca/en/news/advanced-news-search/news-results.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Canada.ca News Centre
        </a>
        {' '}and{' '}
        <a
          href="https://pm.gc.ca/en/news.rss"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Prime Minister RSS Feed
        </a>
        . Entity connections shown do not imply wrongdoing.
      </p>
    </main>
  )
}
