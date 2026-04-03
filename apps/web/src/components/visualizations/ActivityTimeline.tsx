import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getTimeline } from '@/server-fns/visualizations'
import type { TimelineEvent } from '@/server-fns/visualizations'
import { useChartColors } from '@/components/visualizations/shared/useChartColors'
import { useResizeObserver } from '@/components/visualizations/shared/useResizeObserver'
import { en } from '@/i18n/en'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ELECTION_YEARS = [2004, 2006, 2008, 2011, 2015, 2019, 2021, 2025] as const

const EVENT_CONFIG = {
  donation: { color: '--primary', shape: 'circle', label: 'Donation' },
  contract: { color: '--ring', shape: 'square', label: 'Contract' },
  grant: { color: '--accent-foreground', shape: 'diamond', label: 'Grant' },
  lobby_registration: { color: '--muted-foreground', shape: 'triangle', label: 'Lobby Reg.' },
  lobby_communication: { color: '--secondary-foreground', shape: 'triangle', label: 'Lobby Comm.' },
} as const

type EventType = keyof typeof EVENT_CONFIG
type ShapeType = (typeof EVENT_CONFIG)[EventType]['shape']

const MARGIN = { top: 30, right: 20, bottom: 50, left: 50 }
const HEIGHT = 320
const AXIS_Y = 160
const MARKER_RADIUS = 6

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ActivityTimelineProps = {
  entityId: string
  className?: string
}

// ---------------------------------------------------------------------------
// Marker rendering helpers
// ---------------------------------------------------------------------------

function renderMarker(
  shape: ShapeType,
  x: number,
  y: number,
  r: number,
  color: string,
  key: string | number,
  onMouseEnter: () => void,
  onMouseLeave: () => void,
) {
  const handlers = { onMouseEnter, onMouseLeave }

  if (shape === 'circle') {
    return <circle key={key} cx={x} cy={y} r={r} fill={color} style={{ cursor: 'pointer' }} {...handlers} />
  }

  if (shape === 'square') {
    return (
      <rect
        key={key}
        x={x - r}
        y={y - r}
        width={r * 2}
        height={r * 2}
        fill={color}
        style={{ cursor: 'pointer' }}
        {...handlers}
      />
    )
  }

  if (shape === 'diamond') {
    return (
      <polygon
        key={key}
        points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
        fill={color}
        style={{ cursor: 'pointer' }}
        {...handlers}
      />
    )
  }

  // triangle (lobby_registration and lobby_communication)
  return (
    <polygon
      key={key}
      points={`${x},${y - r} ${x + r},${y + r / 2} ${x - r},${y + r / 2}`}
      fill={color}
      style={{ cursor: 'pointer' }}
      {...handlers}
    />
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityTimeline({ entityId, className }: ActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useResizeObserver(containerRef)
  const { getColor } = useChartColors()

  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [translateX, setTranslateX] = useState(0)
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Fetch events on entityId change
  useEffect(() => {
    setLoading(true)
    setError(null)

    getTimeline({ data: { id: entityId } })
      .then((response) => {
        setEvents(response.events)
      })
      .catch(() => {
        setError(en.common.error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [entityId])

  // Parse event dates
  const parsedEvents = useMemo(() => {
    return events
      .map((event) => {
        const d = new Date(event.date)
        return Number.isNaN(d.getTime()) ? null : { event, date: d }
      })
      .filter((e): e is { event: TimelineEvent; date: Date } => e !== null)
  }, [events])

  // Compute scroll width and time scale
  const scrollWidth = useMemo(() => {
    return Math.max(width, parsedEvents.length * 12 + MARGIN.left + MARGIN.right)
  }, [width, parsedEvents.length])

  const xScale = useMemo(() => {
    if (parsedEvents.length === 0 || width === 0) return null

    const dates = parsedEvents.map((e) => e.date)
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    return d3
      .scaleTime()
      .domain([minDate, maxDate])
      .range([MARGIN.left, scrollWidth - MARGIN.right])
  }, [parsedEvents, scrollWidth, width])

  // Attach d3.zoom for horizontal-only scroll (Pitfall 2: attach once on mount)
  useEffect(() => {
    if (!containerRef.current || width === 0) return

    const container = d3.select(containerRef.current)
    const zoom = d3
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent([1, 1])
      .translateExtent([
        [0, 0],
        [scrollWidth, HEIGHT],
      ])
      .on('zoom', (event: d3.D3ZoomEvent<HTMLDivElement, unknown>) => {
        setTranslateX(event.transform.x)
      })

    container.call(zoom)

    return () => {
      container.on('.zoom', null)
    }
  }, [scrollWidth, width])

  // X-axis tick positions
  const xTicks = useMemo(() => {
    if (!xScale) return []
    const interval = d3.timeYear.every(2)
    return interval ? xScale.ticks(interval) : xScale.ticks(10)
  }, [xScale])

  // Election year line positions within domain
  const electionLines = useMemo(() => {
    if (!xScale) return []
    const [domainMin, domainMax] = xScale.domain() as [Date, Date]
    return ELECTION_YEARS.filter((year) => {
      const d = new Date(year, 0, 1)
      return d >= domainMin && d <= domainMax
    }).map((year) => ({
      year,
      x: xScale(new Date(year, 0, 1)),
    }))
  }, [xScale])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[320px] items-center justify-center text-muted-foreground">
        {en.viz.timeline.loadingLabel}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[320px] items-center justify-center text-destructive">
        {error}
      </div>
    )
  }

  // Empty state
  if (!loading && events.length === 0) {
    return (
      <p className="flex h-[320px] items-center justify-center text-muted-foreground text-sm">
        {en.viz.timeline.emptyLabel}
      </p>
    )
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* Scrollable container — d3.zoom handles transform */}
      <div
        ref={containerRef}
        className="overflow-hidden select-none"
        style={{ height: HEIGHT }}
      >
        <svg
          width={scrollWidth}
          height={HEIGHT}
          role="img"
          aria-label={en.viz.timeline.ariaLabel}
        >
          <g transform={`translate(${translateX}, 0)`}>
            {/* Axis line */}
            <line
              x1={MARGIN.left}
              x2={scrollWidth - MARGIN.right}
              y1={AXIS_Y}
              y2={AXIS_Y}
              stroke="currentColor"
              strokeOpacity={0.2}
            />

            {/* Election year reference lines */}
            {electionLines.map(({ year, x }) => (
              <g key={year}>
                <line
                  x1={x}
                  x2={x}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  stroke="currentColor"
                  strokeOpacity={0.15}
                  strokeDasharray="4,4"
                />
                <text
                  x={x}
                  y={MARGIN.top - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={0.5}
                >
                  {year}
                </text>
              </g>
            ))}

            {/* Event markers */}
            {xScale &&
              parsedEvents.map(({ event, date }, i) => {
                const eventType = event.eventType as EventType
                const config = EVENT_CONFIG[eventType] ?? EVENT_CONFIG.donation
                const color = getColor(config.color)
                const x = xScale(date)

                return renderMarker(
                  config.shape,
                  x,
                  AXIS_Y,
                  MARKER_RADIUS,
                  color,
                  i,
                  () => {
                    setHoveredEvent(event)
                    setTooltipPos({ x, y: AXIS_Y })
                  },
                  () => setHoveredEvent(null),
                )
              })}

            {/* X-axis ticks */}
            {xTicks.map((tick) => {
              const x = xScale ? xScale(tick) : 0
              return (
                <g key={tick.getTime()}>
                  <line
                    x1={x}
                    x2={x}
                    y1={AXIS_Y + 4}
                    y2={AXIS_Y + 8}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                  />
                  <text
                    x={x}
                    y={AXIS_Y + 20}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.6}
                  >
                    {tick.getFullYear()}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredEvent && (
          <div
            className="absolute z-10 rounded-md border bg-popover px-3 py-2 shadow-md text-xs text-popover-foreground pointer-events-none"
            style={{
              left: translateX + tooltipPos.x + 10,
              top: tooltipPos.y - 40,
              maxWidth: 200,
            }}
          >
            <p className="font-medium">{hoveredEvent.date}</p>
            <p>{EVENT_CONFIG[hoveredEvent.eventType as EventType]?.label ?? hoveredEvent.eventType}</p>
            <p className="text-muted-foreground truncate">{hoveredEvent.description}</p>
            {hoveredEvent.amount !== null && (
              <p className="font-medium">
                ${hoveredEvent.amount.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1">
        {Object.entries(EVENT_CONFIG).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: getColor(config.color) }}
            />
            {config.label}
          </div>
        ))}
      </div>
    </div>
  )
}
