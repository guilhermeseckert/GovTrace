import { ExternalLink, Newspaper } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

export function RecentSpending({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No spending announcements yet. Run the press release ingestion to populate this section.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const topAmount = item.dollarAmounts[0]?.amount ?? ''
        return (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm font-medium leading-snug group-hover:text-primary group-hover:underline">
                    {item.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted-foreground">
                  <span>{formatDate(item.publishedDate)}</span>
                  <span>&middot;</span>
                  <span>{item.department}</span>
                  {item.ministers.length > 0 && (
                    <>
                      <span>&middot;</span>
                      <span>{item.ministers.join(', ')}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {topAmount && (
                  <Badge variant="secondary" className="font-mono text-xs font-semibold">
                    {topAmount}
                  </Badge>
                )}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </a>
        )
      })}

      <p className="pt-2 text-xs text-muted-foreground">
        Source: canada.ca press releases and PM office announcements. Dollar amounts extracted automatically.
      </p>
    </div>
  )
}
