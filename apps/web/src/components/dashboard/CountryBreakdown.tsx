import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from '@tanstack/react-router'
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
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const displayed = expanded
    ? (search
        ? data.filter((r) => r.countryName.toLowerCase().includes(search.toLowerCase()))
        : data)
    : data.slice(0, MAX_DISPLAY)
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
            <Link
              key={row.countryCode}
              to="/aid/country/$code"
              params={{ code: row.countryCode }}
              className="block rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-muted/50 cursor-pointer"
            >
              <div className="space-y-1">
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
            </Link>
          )
        })}
      </div>

      {remaining > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
        >
          <ChevronDown className="h-3 w-3" />
          and {remaining} more {remaining === 1 ? 'country' : 'countries'}
        </button>
      )}

      {expanded && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{displayed.length} {displayed.length === 1 ? 'country' : 'countries'}</span>
            <button
              type="button"
              onClick={() => { setExpanded(false); setSearch('') }}
              className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
            >
              <ChevronUp className="h-3 w-3" />
              Show less
            </button>
          </div>
        </div>
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
