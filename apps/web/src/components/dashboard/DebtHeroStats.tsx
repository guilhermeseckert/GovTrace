import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DebtHeroStats } from '@/server-fns/dashboard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDebt(billions: number): string {
  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(1)} trillion`
  }
  return `$${billions.toFixed(1)} billion`
}

function formatAid(billions: number): string {
  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(1)} trillion`
  }
  return `$${billions.toFixed(1)} billion`
}

function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  stats: DebtHeroStats
}

export function DebtHeroStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Card 1: National Debt */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            National Debt
            <a
              href={stats.sourceDebtUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Statistics Canada debt data source"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums text-destructive">
            {stats.currentDebtBillions > 0
              ? formatDebt(stats.currentDebtBillions)
              : '—'}
          </p>
          {stats.debtAsOf && (
            <p className="mt-1 text-xs text-muted-foreground">
              As of {formatDate(stats.debtAsOf)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Overseas Aid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Overseas Aid
            <a
              href={stats.sourceAidUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Global Affairs Canada aid data source"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {stats.totalAidBillions > 0
              ? formatAid(stats.totalAidBillions)
              : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">total committed</p>
        </CardContent>
      </Card>

      {/* Card 3: Aid as % of Debt */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Aid as % of Debt
            <a
              href={stats.sourceAidUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View aid data source"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {stats.aidAsPercentOfDebt > 0
              ? `${stats.aidAsPercentOfDebt.toFixed(1)}%`
              : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            of national debt committed to overseas aid
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
