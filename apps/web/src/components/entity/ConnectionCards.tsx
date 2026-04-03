import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { getConnections } from '@/server-fns/datasets'
import { CONNECTION_LABELS, formatAmount } from '@/lib/connection-labels'
import { en } from '@/i18n/en'

const BORDER_COLORS: Record<string, string> = {
  donor_to_party: 'border-l-blue-500',
  vendor_to_department: 'border-l-emerald-500',
  grant_recipient_to_department: 'border-l-amber-500',
  lobbyist_to_official: 'border-l-purple-500',
  lobbyist_client_to_official: 'border-l-pink-500',
}

const DEFAULT_VISIBLE = 10

type ConnectionCardsProps = {
  entityId: string
}

export function ConnectionCards({ entityId }: ConnectionCardsProps) {
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['connection-cards', entityId],
    queryFn: () =>
      getConnections({
        data: {
          entityId,
          page: 1,
          pageSize: 100,
          sortBy: 'totalValue',
          sortDir: 'desc',
        },
      }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={`skeleton-${String(i)}`}
            className="rounded-lg border border-l-4 bg-card p-4 shadow-sm"
          >
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  if (isError || !data || data.rows.length === 0) {
    return null
  }

  const visible = expanded ? data.rows : data.rows.slice(0, DEFAULT_VISIBLE)

  return (
    <div className="space-y-3">
      {visible.map((row) => {
        const labelConfig = CONNECTION_LABELS[row.connectionType]
        const label = labelConfig?.label ?? row.connectionType
        const badgeColor =
          labelConfig?.color ?? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
        const borderColor = BORDER_COLORS[row.connectionType] ?? 'border-l-gray-400'

        return (
          <div
            key={row.id}
            className={`max-w-full rounded-lg border border-l-4 bg-card p-4 shadow-sm ${borderColor}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/entity/$id"
                params={{ id: row.connectedEntityId }}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {row.connectedEntityName ?? row.connectedEntityId}
              </Link>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
              >
                {label}
              </span>
              <span className="tabular-nums text-sm font-semibold text-foreground">
                {formatAmount(row.totalValue)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.transactionCount} transaction{row.transactionCount !== 1 ? 's' : ''}
            </p>
          </div>
        )
      })}

      {!expanded && data.rows.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-lg border border-dashed p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Show all {data.total} connections
        </button>
      )}

      <p className="mt-4 text-xs italic text-muted-foreground">{en.profile.disclaimer}</p>
    </div>
  )
}
