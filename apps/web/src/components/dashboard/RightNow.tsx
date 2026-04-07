import { ExternalLink } from 'lucide-react'
import type { RecentSpendingAnnouncement } from '@/server-fns/dashboard'

function formatDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

type Props = {
  data: RecentSpendingAnnouncement[]
}

export function RightNow({ data }: Props) {
  if (data.length === 0) {
    return null
  }

  const featured = data.slice(0, 3)
  const remaining = data.slice(3)

  return (
    <section aria-labelledby="right-now-heading">
      <h2 id="right-now-heading" className="mb-1 text-2xl font-bold tracking-tight">
        Right Now
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        The latest government spending announcements
      </p>

      <div className="space-y-4">
        {featured.map((item) => {
          const topAmount = item.dollarAmounts[0]
          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border bg-card p-5 transition-colors duration-200 hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(item.publishedDate)} &middot; {item.department}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug group-hover:text-primary group-hover:underline">
                    {item.title}
                  </p>
                  {topAmount && (
                    <p className="mt-2 text-xs text-muted-foreground">{topAmount.context}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {topAmount && (
                    <span className="text-3xl font-bold tabular-nums text-primary md:text-3xl">
                      {topAmount.amount}
                    </span>
                  )}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
            </a>
          )
        })}

        {remaining.length > 0 && (
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Also announced
            </p>
            {remaining.map((item) => {
              const topAmount = item.dollarAmounts[0]
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded py-1.5 transition-colors duration-200 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm leading-snug group-hover:underline">{item.title}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {topAmount && (
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        {topAmount.amount}
                      </span>
                    )}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
