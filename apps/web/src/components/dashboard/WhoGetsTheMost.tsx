import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { TopRecipientWithConnections } from '@/server-fns/dashboard'

function formatCurrency(dollars: number): string {
  const abs = Math.abs(dollars)
  if (abs >= 1_000_000_000) {
    return `$${(abs / 1_000_000_000).toFixed(1)}B`
  }
  if (abs >= 1_000_000) {
    return `$${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `$${(abs / 1_000).toFixed(0)}K`
  }
  return `$${abs.toFixed(0)}`
}

type Props = {
  data: TopRecipientWithConnections[] | undefined
}

export function WhoGetsTheMost({ data }: Props) {
  return (
    <section aria-labelledby="who-gets-most-heading">
      <h2 id="who-gets-most-heading" className="mb-1 text-2xl font-bold tracking-tight">
        Who Gets the Most
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Top government contractors and grant recipients — and their political connections
      </p>

      <div className="space-y-3">
        {data === undefined ? (
          <>
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </>
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              Top recipients will appear here soon
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              GovTrace is still matching contract and grant records to known entities.
              Once linking is complete, you will see who receives the most public money —
              along with their donations and lobbying activity.
            </p>
          </div>
        ) : (
          data.map((recipient) => (
            <div
              key={recipient.entityId}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  {recipient.entityId ? (
                    <Link
                      to="/entity/$id"
                      params={{ id: recipient.entityId }}
                      className="text-base font-semibold transition-colors duration-200 hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {recipient.name}
                    </Link>
                  ) : (
                    <span className="text-base font-semibold">{recipient.name}</span>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {recipient.recordCount}{' '}
                      {recipient.type === 'contractor' ? 'contracts' : 'grants'}
                    </Badge>
                    {recipient.lobbyingCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {recipient.lobbyingCount} lobbying meetings
                      </Badge>
                    )}
                    {recipient.donationCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {recipient.donationCount} donations
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-2xl font-bold tabular-nums">
                  {formatCurrency(recipient.totalValue)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
