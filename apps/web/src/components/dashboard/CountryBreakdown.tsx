import { ExternalLink } from 'lucide-react'
import type { CountrySpendingRow } from '@/server-fns/dashboard'
import { getFlag } from '@/lib/country-codes'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DISPLAY = 15
const GAC_DATASET_URL =
  'https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cad: number): string {
  if (cad >= 1_000_000_000) {
    return `$${(cad / 1_000_000_000).toFixed(1)}B`
  }
  if (cad >= 1_000_000) {
    return `$${(cad / 1_000_000).toFixed(1)}M`
  }
  if (cad >= 1_000) {
    return `$${(cad / 1_000).toFixed(0)}K`
  }
  return `$${cad.toFixed(0)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  data: CountrySpendingRow[]
}

export function CountryBreakdown({ data }: Props) {
  const displayed = data.slice(0, MAX_DISPLAY)
  const remaining = data.length - MAX_DISPLAY

  const maxPct = displayed.length > 0 ? Math.max(...displayed.map((r) => r.pctOfTotal)) : 100

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No country data available yet. Run the aid ingestion pipeline to populate this section.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {displayed.map((row) => {
          const barWidth = maxPct > 0 ? (row.pctOfTotal / maxPct) * 100 : 0
          const flag = getFlag(row.countryCode)
          const label = flag ? `${flag} ${row.countryName}` : row.countryName
          return (
            <div key={row.countryCode} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium" title={row.countryName}>
                  {label}
                </span>
                <div className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
                  <span>{formatCurrency(row.totalCommittedCad)}</span>
                  <span className="w-12 text-right text-xs">{row.pctOfTotal.toFixed(1)}%</span>
                  <span className="hidden w-20 text-right text-xs sm:block">
                    {row.projectCount.toLocaleString()} projects
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                  aria-label={`${row.pctOfTotal.toFixed(1)}% of total aid committed to ${row.countryName}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          and {remaining} more {remaining === 1 ? 'country' : 'countries'}
        </p>
      )}

      {/* Source link */}
      <div className="border-t pt-3">
        <a
          href={GAC_DATASET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Source: Global Affairs Canada IATI Activity Files
        </a>
      </div>
    </div>
  )
}
