import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { AlertTriangle, TrendingUp, Users, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPatternsFeed } from '@/server-fns/detect-patterns'
import { DataFreshness } from '@/components/dashboard/DataFreshness'

const PATTERN_TYPES = [
  {
    id: 'donation_spike_near_contract',
    label: 'Donation spike near contract',
    icon: TrendingUp,
  },
  {
    id: 'lobbying_cluster_before_contract',
    label: 'Lobbying cluster before contract',
    icon: Users,
  },
  {
    id: 'outlier_contribution',
    label: 'Outlier contribution',
    icon: Zap,
  },
] as const

const PAGE_SIZE = 50

export const Route = createFileRoute('/patterns')({
  head: () => ({
    meta: [{ title: 'Patterns | GovTrace' }],
  }),
  validateSearch: z.object({
    entity: z.string().uuid().optional(),
    type: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ entity: search.entity, type: search.type }),
  loader: async ({ deps }) => {
    const result = await getPatternsFeed({
      data: {
        offset: 0,
        limit: PAGE_SIZE,
        patternType: deps.type,
        entityId: deps.entity,
      },
    })
    return result
  },
  component: PatternsPage,
})

function severityBadgeClass(severity: string): string {
  if (severity === 'high') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400'
  if (severity === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
  return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400'
}

function patternTypeLabel(type: string): string {
  const found = PATTERN_TYPES.find((p) => p.id === type)
  return found?.label ?? type
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${String(diffDays)} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${String(diffMonths)} month${diffMonths !== 1 ? 's' : ''} ago`
  const diffYears = Math.floor(diffMonths / 12)
  return `${String(diffYears)} year${diffYears !== 1 ? 's' : ''} ago`
}

function PatternsPage() {
  const { items: initialItems, total } = Route.useLoaderData()
  const { entity: entityFilter, type: typeFilter } = Route.useSearch()
  const navigate = Route.useNavigate()

  const [offset, setOffset] = useState(0)
  const [allItems, setAllItems] = useState(initialItems)

  const { isFetching } = useQuery({
    queryKey: ['patterns-feed', typeFilter, entityFilter, offset],
    queryFn: async () => {
      const result = await getPatternsFeed({
        data: {
          offset,
          limit: PAGE_SIZE,
          patternType: typeFilter,
          entityId: entityFilter,
        },
      })
      if (offset === 0) {
        setAllItems(result.items)
      } else {
        setAllItems((prev) => [...prev, ...result.items])
      }
      return result
    },
    enabled: offset > 0,
    staleTime: 1000 * 60 * 5,
  })

  const handleTypeFilter = (type: string) => {
    setOffset(0)
    setAllItems([])
    void navigate({
      search: (prev) => ({
        ...prev,
        type: typeFilter === type ? undefined : type,
      }),
    })
  }

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE)
  }

  const hasMore = allItems.length < total

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-normal tracking-tight">Detected Patterns</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Automatically flagged connections between donations, contracts, and lobbying activity.
          Temporal proximity does not imply causation.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {String(total)} flagged pattern{total !== 1 ? 's' : ''} detected
        </p>
      </div>

      {/* Type filter bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PATTERN_TYPES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleTypeFilter(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
        {typeFilter && (
          <button
            type="button"
            onClick={() => handleTypeFilter(typeFilter)}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Pattern cards */}
      {allItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          {typeFilter ? (
            <>
              <p className="text-sm font-medium text-foreground">
                No {patternTypeLabel(typeFilter).toLowerCase()} patterns detected yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The detection pipeline runs weekly. Check back after the next scheduled run,
                or clear the filter to see all detected patterns.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Pattern detection has not run yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Patterns will appear here once the detection pipeline processes donations,
                contracts, and lobbying data. The pipeline runs automatically each week.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {allItems.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold uppercase tracking-wide ${severityBadgeClass(item.severity)}`}
                >
                  {item.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {patternTypeLabel(item.patternType)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {relativeTime(item.detectedAt)}
                </span>
              </div>

              <h2 className="mb-1 text-sm font-semibold leading-snug text-foreground">
                {item.title}
              </h2>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link
                  to="/entity/$id"
                  params={{ id: item.entityId }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.entityName}
                </Link>
                {item.relatedEntityId && item.relatedEntityName && (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <Link
                      to="/entity/$id"
                      params={{ id: item.relatedEntityId }}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {item.relatedEntityName}
                    </Link>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Data freshness */}
      {allItems.length > 0 && (
        <div className="mt-6">
          <DataFreshness sources={['elections_canada', 'contracts', 'lobby_communications']} />
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isFetching}
          >
            {isFetching ? 'Loading...' : `Load more (${String(total - allItems.length)} remaining)`}
          </Button>
        </div>
      )}
    </main>
  )
}
