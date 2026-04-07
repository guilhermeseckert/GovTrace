import { useQuery } from '@tanstack/react-query'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { getDataFreshness } from '@/server-fns/dashboard'
import type { DataFreshnessRow } from '@/server-fns/dashboard'
import { Skeleton } from '@/components/ui/skeleton'

const SOURCE_LABELS: Record<string, string> = {
  elections_canada: 'Elections Canada (donations)',
  contracts: 'Government contracts',
  grants: 'Grants and contributions',
  lobby_registrations: 'Lobbying registrations',
  lobby_communications: 'Lobbying communications',
  public_accounts: 'Public accounts',
  gazette_regulations: 'Canada Gazette regulations',
  news: 'Government news & press releases',
}

function formatFreshness(isoStr: string | null): string {
  if (!isoStr) return 'Never'
  try {
    const date = new Date(isoStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'Less than an hour ago'
    if (diffHours < 24) return `${String(diffHours)} hour${diffHours !== 1 ? 's' : ''} ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 30) return `${String(diffDays)} days ago`
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return isoStr
  }
}

function freshnessColor(isoStr: string | null): string {
  if (!isoStr) return 'text-muted-foreground'
  const diffMs = Date.now() - new Date(isoStr).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 2) return 'text-green-600 dark:text-green-400'
  if (diffDays < 14) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

type Props = {
  /** Optional subset of sources to show. Shows all if omitted. */
  sources?: string[]
}

function FreshnessRow({ row }: { row: DataFreshnessRow }) {
  const label = SOURCE_LABELS[row.sourceName] ?? row.sourceName
  const colorClass = freshnessColor(row.lastUpdated)

  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${colorClass}`}>{formatFreshness(row.lastUpdated)}</span>
    </div>
  )
}

export function DataFreshness({ sources }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['data-freshness'],
    queryFn: () => getDataFreshness(),
    staleTime: 1000 * 60 * 15,
  })

  const rows = (data ?? []).filter(
    (r) => !sources || sources.includes(r.sourceName),
  )

  return (
    <details className="group rounded-lg border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Data freshness
        <ChevronDown
          className="ml-auto h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="divide-y px-4 pb-3">
        {isLoading ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground italic">
            No ingestion runs recorded yet.
          </p>
        ) : (
          rows.map((row) => <FreshnessRow key={row.sourceName} row={row} />)
        )}
      </div>
    </details>
  )
}
