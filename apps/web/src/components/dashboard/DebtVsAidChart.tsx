import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { FEDERAL_ELECTION_DATES } from '@/lib/constants/elections'
import type { DebtAidDataPoint } from '@/server-fns/dashboard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  data: DebtAidDataPoint[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBillions(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}T`
  }
  return `$${value}B`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DebtVsAidChart({ data }: Props) {
  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No data available. Run the fiscal ingestion pipeline to populate this chart.
        </p>
      </div>
    )
  }

  // Filter election markers to years within the data range
  const dataYears = data.map((d) => d.year)
  const minYear = Math.min(...dataYears)
  const maxYear = Math.max(...dataYears)
  const electionMarkers = FEDERAL_ELECTION_DATES.filter(
    (e) => e.year >= minYear && e.year <= maxYear,
  )

  return (
    <div
      className="space-y-2"
      role="img"
      aria-label="National debt versus overseas aid spending over time"
    >
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 30, right: 70, bottom: 10, left: 80 }}>
          <CartesianGrid strokeDasharray="4 2" stroke="hsl(var(--border))" strokeOpacity={0.5} />

          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />

          {/* Left Y-axis — national debt */}
          <YAxis
            yAxisId="debt"
            orientation="left"
            tickFormatter={formatBillions}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            label={{
              value: 'National Debt ($ billions)',
              angle: -90,
              position: 'insideLeft',
              offset: -60,
              style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
            }}
          />

          {/* Right Y-axis — aid committed */}
          <YAxis
            yAxisId="aid"
            orientation="right"
            tickFormatter={formatBillions}
            tick={{ fontSize: 11, fill: '#2563eb' }}
            tickLine={{ stroke: '#2563eb' }}
            axisLine={{ stroke: '#2563eb' }}
            label={{
              value: 'Aid Committed ($ billions)',
              angle: 90,
              position: 'insideRight',
              offset: -55,
              style: { fontSize: 11, fill: '#2563eb' },
            }}
          />

          <Tooltip
            formatter={(value, name) => {
              const numValue = typeof value === 'number' ? value : 0
              const label = name === 'debtBillionsCad' ? 'National Debt' : 'Overseas Aid Committed'
              return [formatBillions(numValue), label]
            }}
            labelFormatter={(label) => `Year: ${label}`}
            contentStyle={{
              fontSize: 12,
              borderRadius: '6px',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }}
          />

          {/* Election year reference lines */}
          {electionMarkers.map((e) => (
            <ReferenceLine
              key={`election-${e.year}`}
              x={e.year}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{
                value: String(e.year),
                position: 'top',
                fontSize: 9,
                fill: 'hsl(var(--muted-foreground))',
                angle: -45,
              }}
            />
          ))}

          {/* National debt line */}
          <Line
            yAxisId="debt"
            type="monotone"
            dataKey="debtBillionsCad"
            stroke="#dc2626"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: '#dc2626', strokeWidth: 2, fill: '#dc2626' }}
          />

          {/* Aid committed line */}
          <Line
            yAxisId="aid"
            type="monotone"
            dataKey="aidCommittedBillionsCad"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: '#2563eb', strokeWidth: 2, fill: '#2563eb' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Dual y-axis annotation */}
      <p className="text-center text-xs text-muted-foreground">
        Note: Dual y-axes — debt and aid are on different scales
      </p>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-6 rounded"
            style={{ backgroundColor: '#dc2626' }}
          />
          National Debt
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-6 rounded"
            style={{ backgroundColor: '#2563eb' }}
          />
          Overseas Aid Committed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed border-muted-foreground opacity-60" />
          Federal Election
        </span>
      </div>
    </div>
  )
}
