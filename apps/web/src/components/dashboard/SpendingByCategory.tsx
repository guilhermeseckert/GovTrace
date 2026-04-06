import { ExternalLink } from 'lucide-react'
import type { SpendingCategoryRow } from '@/server-fns/dashboard'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PA_DATASET_URL =
  'https://open.canada.ca/data/en/dataset/a35cf382-690c-4221-a971-cf0fd189a46f'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cad: number): string {
  const abs = Math.abs(cad)
  const sign = cad < 0 ? '-' : ''
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}K`
  }
  return `${sign}$${abs.toFixed(0)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  data: SpendingCategoryRow[]
}

export function SpendingByCategory({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No spending data available yet. Run the public-accounts ingestion pipeline to populate this section.
        </p>
      </div>
    )
  }

  // Separate positive (expenditures) from negative (revenues) for normalization
  const positiveRows = data.filter((r) => r.amount >= 0)
  const negativeRows = data.filter((r) => r.amount < 0)

  const maxPositive = positiveRows.length > 0 ? Math.max(...positiveRows.map((r) => r.amount)) : 1
  const grandTotal = positiveRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {/* Positive expenditure rows */}
        {positiveRows.map((row) => {
          const barWidth = maxPositive > 0 ? (row.amount / maxPositive) * 100 : 0
          const pct = grandTotal > 0 ? (row.amount / grandTotal) * 100 : 0
          return (
            <div key={row.category} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium" title={row.category}>
                  {row.category}
                </span>
                <div className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
                  <span>{formatCurrency(row.amount)}</span>
                  <span className="w-12 text-right text-xs">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                  aria-label={`${pct.toFixed(1)}% of total expenditures`}
                />
              </div>
            </div>
          )
        })}

        {/* Revenue rows (negative values) — visually distinct */}
        {negativeRows.length > 0 && (
          <>
            <div className="border-t pt-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Revenue credits (reduce net expenditures)
              </p>
              {negativeRows.map((row) => (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground" title={row.category}>
                      {row.category}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-muted-foreground/30 transition-all duration-500"
                      style={{ width: '100%' }}
                      aria-label="Revenue credit"
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Source link */}
      <div className="border-t pt-3">
        <a
          href={PA_DATASET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Source: Public Accounts of Canada — Expenditures by Standard Object
        </a>
      </div>
    </div>
  )
}
