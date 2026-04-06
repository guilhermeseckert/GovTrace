import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { SectorSpendingRow } from '@/server-fns/dashboard'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DISPLAY = 10
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
  data: SectorSpendingRow[]
}

export function SectorBreakdown({ data }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const remaining = data.length - MAX_DISPLAY

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No sector data available yet. Sector data will appear after the next IATI data ingestion.
        </p>
      </div>
    )
  }

  // When collapsed show top 10; when expanded, filter by search
  const displayed = expanded
    ? data.filter((r) =>
        r.theme.toLowerCase().includes(search.toLowerCase()),
      )
    : data.slice(0, MAX_DISPLAY)

  const maxPct =
    displayed.length > 0 ? Math.max(...displayed.map((r) => r.pctOfTotal)) : 100

  return (
    <div className="space-y-4">
      {/* Search input — only when expanded */}
      {expanded && (
        <input
          type="text"
          placeholder="Search sectors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}

      <div className="space-y-2">
        {displayed.map((row) => {
          const barWidth = maxPct > 0 ? (row.pctOfTotal / maxPct) * 100 : 0
          return (
            <div key={row.theme} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium" title={row.theme}>
                  {row.theme}
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
                  aria-label={`${row.pctOfTotal.toFixed(1)}% of sector aid — ${row.theme}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Collapse footer — shown when expanded */}
      {expanded && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {displayed.length} of {data.length} sectors
          </span>
          <button
            type="button"
            onClick={() => {
              setExpanded(false)
              setSearch('')
            }}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Show less
          </button>
        </div>
      )}

      {/* Overflow count — shown when collapsed and there are more */}
      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          and {remaining} more {remaining === 1 ? 'sector' : 'sectors'}
        </button>
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
