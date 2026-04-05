import { useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { useResizeObserver } from '@/components/visualizations/shared/useResizeObserver'
import { FEDERAL_ELECTION_DATES } from '@/lib/constants/elections'
import type { DebtAidDataPoint } from '@/server-fns/dashboard'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 30, right: 70, bottom: 50, left: 80 }
const CHART_HEIGHT = 400

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  data: DebtAidDataPoint[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DebtVsAidChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width: containerWidth } = useResizeObserver(
    containerRef as React.RefObject<HTMLElement>,
  )

  const width = containerWidth > 0 ? containerWidth : 600
  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

  // Build chart from D3 math — React renders the SVG elements
  const chart = useMemo(() => {
    if (data.length === 0 || innerWidth <= 0) return null

    // x scale — time domain from min to max year
    const years = data.map((d) => new Date(d.year, 0, 1))
    const xScale = d3
      .scaleTime()
      .domain([d3.min(years) ?? new Date(1990, 0, 1), d3.max(years) ?? new Date()])
      .range([0, innerWidth])

    // y scale left — debt in billions
    const debtMax = d3.max(data, (d) => d.debtBillionsCad) ?? 1
    const yDebt = d3
      .scaleLinear()
      .domain([0, debtMax * 1.1])
      .range([innerHeight, 0])
      .nice()

    // y scale right — aid in billions
    const aidMax = d3.max(data, (d) => d.aidCommittedBillionsCad) ?? 1
    const yAid = d3
      .scaleLinear()
      .domain([0, aidMax * 1.1])
      .range([innerHeight, 0])
      .nice()

    // Line generators
    const debtLineGen = d3
      .line<DebtAidDataPoint>()
      .x((d) => xScale(new Date(d.year, 0, 1)))
      .y((d) => yDebt(d.debtBillionsCad))
      .curve(d3.curveMonotoneX)

    const aidLineGen = d3
      .line<DebtAidDataPoint>()
      .x((d) => xScale(new Date(d.year, 0, 1)))
      .y((d) => yAid(d.aidCommittedBillionsCad))
      .curve(d3.curveMonotoneX)

    // X axis ticks — guard for undefined (d3 may return undefined)
    const timeEvery2 = d3.timeYear.every(2)
    const xTicks = timeEvery2
      ? xScale.ticks(timeEvery2)
      : xScale.ticks(8)

    // Y axis ticks — debt (left) and aid (right)
    const debtTicks = yDebt.ticks(6)
    const aidTicks = yAid.ticks(6)

    // Election year markers within chart domain
    const xDomain = xScale.domain()
    const xMin = xDomain[0]
    const xMax = xDomain[1]
    const elections = FEDERAL_ELECTION_DATES.filter((e) => {
      if (!xMin || !xMax) return false
      const elYear = new Date(e.year, 0, 1)
      return elYear >= xMin && elYear <= xMax
    })

    const debtPath = debtLineGen(data) ?? ''
    const aidPath = aidLineGen(data) ?? ''

    return {
      xScale,
      yDebt,
      yAid,
      xTicks,
      debtTicks,
      aidTicks,
      elections,
      debtPath,
      aidPath,
    }
  }, [data, innerWidth, innerHeight])

  // Empty state
  if (data.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-[400px] items-center justify-center rounded-lg border border-dashed"
      >
        <p className="text-sm text-muted-foreground">
          No data available. Run the fiscal ingestion pipeline to populate this chart.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full">
        <svg
          role="img"
          aria-label="National debt versus overseas aid spending over time"
          width={width}
          height={CHART_HEIGHT}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {chart && (
              <>
                {/* Grid lines */}
                {chart.debtTicks.map((tick) => (
                  <line
                    key={`grid-${tick}`}
                    x1={0}
                    x2={innerWidth}
                    y1={chart.yDebt(tick)}
                    y2={chart.yDebt(tick)}
                    stroke="var(--border)"
                    strokeWidth={0.5}
                    strokeDasharray="4,2"
                  />
                ))}

                {/* Election markers */}
                {chart.elections.map((e) => {
                  const x = chart.xScale(new Date(e.year, 0, 1))
                  return (
                    <g key={`election-${e.year}`}>
                      <line
                        x1={x}
                        x2={x}
                        y1={0}
                        y2={innerHeight}
                        stroke="var(--muted-foreground)"
                        strokeWidth={1}
                        strokeDasharray="4,2"
                        opacity={0.6}
                      />
                      <text
                        x={x}
                        y={-8}
                        textAnchor="middle"
                        fontSize={9}
                        fill="var(--muted-foreground)"
                        transform={`rotate(-45, ${x}, -8)`}
                      >
                        {e.year}
                      </text>
                    </g>
                  )
                })}

                {/* Debt line */}
                <path
                  d={chart.debtPath}
                  fill="none"
                  stroke="var(--destructive)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Aid line */}
                <path
                  d={chart.aidPath}
                  fill="none"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* X axis */}
                <g transform={`translate(0,${innerHeight})`}>
                  <line x1={0} x2={innerWidth} y1={0} y2={0} stroke="var(--border)" />
                  {chart.xTicks.map((tick) => {
                    const x = chart.xScale(tick)
                    return (
                      <g key={`xtick-${tick.getFullYear()}`} transform={`translate(${x},0)`}>
                        <line y1={0} y2={4} stroke="var(--border)" />
                        <text
                          y={14}
                          textAnchor="middle"
                          fontSize={11}
                          fill="var(--muted-foreground)"
                        >
                          {tick.getFullYear()}
                        </text>
                      </g>
                    )
                  })}
                </g>

                {/* Y axis left — debt */}
                <g>
                  <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="var(--border)" />
                  {chart.debtTicks.map((tick) => {
                    const y = chart.yDebt(tick)
                    return (
                      <g key={`ytick-left-${tick}`} transform={`translate(0,${y})`}>
                        <line x1={-4} x2={0} stroke="var(--border)" />
                        <text
                          x={-8}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontSize={11}
                          fill="var(--muted-foreground)"
                        >
                          {tick >= 1000 ? `$${(tick / 1000).toFixed(0)}T` : `$${tick}B`}
                        </text>
                      </g>
                    )
                  })}
                  <text
                    transform={`rotate(-90, -55, ${innerHeight / 2})`}
                    x={-55}
                    y={innerHeight / 2}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--muted-foreground)"
                  >
                    National Debt ($ billions)
                  </text>
                </g>

                {/* Y axis right — aid */}
                <g transform={`translate(${innerWidth},0)`}>
                  <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="var(--border)" />
                  {chart.aidTicks.map((tick) => {
                    const y = chart.yAid(tick)
                    return (
                      <g key={`ytick-right-${tick}`} transform={`translate(0,${y})`}>
                        <line x1={0} x2={4} stroke="var(--border)" />
                        <text
                          x={8}
                          textAnchor="start"
                          dominantBaseline="middle"
                          fontSize={11}
                          fill="var(--chart-2)"
                        >
                          {tick >= 1000 ? `$${(tick / 1000).toFixed(0)}T` : `$${tick}B`}
                        </text>
                      </g>
                    )
                  })}
                  <text
                    transform={`rotate(90, ${MARGIN.right - 10}, ${innerHeight / 2})`}
                    x={MARGIN.right - 10}
                    y={innerHeight / 2}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--chart-2)"
                  >
                    Aid Committed ($ billions)
                  </text>
                </g>
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Dual y-axis annotation */}
      <p className="text-center text-xs text-muted-foreground">
        Note: Dual y-axes — debt and aid are on different scales
      </p>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-6 rounded"
            style={{ backgroundColor: 'var(--destructive)' }}
          />
          National Debt
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-6 rounded"
            style={{ backgroundColor: 'var(--chart-2)' }}
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
