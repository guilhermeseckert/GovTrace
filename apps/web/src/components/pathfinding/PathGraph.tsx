import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import * as d3 from 'd3'
import type { PathEdge, PathNode, PathResponse } from '@/server-fns/pathfinding'
import { useChartColors } from '@/components/visualizations/shared/useChartColors'
import { en } from '@/i18n/en'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SimNode = d3.SimulationNodeDatum & PathNode

type SimLink = d3.SimulationLinkDatum<SimNode> & PathEdge

type TooltipState = {
  node: SimNode
  x: number
  y: number
} | null

type TransformState = {
  x: number
  y: number
  k: number
}

// ---------------------------------------------------------------------------
// Edge style helpers (same as NetworkGraph)
// ---------------------------------------------------------------------------

function getStrokeWidth(transactionCount: number): number {
  return Math.min(Math.log1p(transactionCount) * 1.5, 8)
}

// ---------------------------------------------------------------------------
// usePathSimulation hook
// ---------------------------------------------------------------------------

function usePathSimulation(allNodes: PathNode[], allEdges: PathEdge[]) {
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)

  useEffect(() => {
    if (allNodes.length === 0) {
      setSimNodes([])
      setSimLinks([])
      return
    }

    // Map PathNode[] to SimNode[]
    const nodes: SimNode[] = allNodes.map(n => ({ ...n }))

    // Map PathEdge[] to SimLink[] — d3 link uses source/target by id
    const links: SimLink[] = allEdges.map(e => ({
      ...e,
      source: e.sourceId,
      target: e.targetId,
    }))

    simulationRef.current?.stop()

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(100),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-250))
      .force('center', d3.forceCenter(400, 250))
      .force('collision', d3.forceCollide<SimNode>(24))

    sim.on('tick', () => {
      setSimNodes(() => [...sim.nodes()])
      setSimLinks(() => [...(links as SimLink[])])
    })

    simulationRef.current = sim

    return () => {
      sim.stop()
    }
  }, [allNodes.length, allEdges.length]) // deliberately .length to avoid infinite re-runs

  return { simNodes, simLinks }
}

// ---------------------------------------------------------------------------
// PathGraph component
// ---------------------------------------------------------------------------

type PathGraphProps = {
  result: PathResponse
  className?: string
}

export function PathGraph({ result, className }: PathGraphProps) {
  const router = useRouter()
  const { nodeColors } = useChartColors()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, k: 1 })
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  const { simNodes, simLinks } = usePathSimulation(result.allNodes, result.allEdges)

  // Attach d3.zoom once on mount (same pattern as NetworkGraph)
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        })
      })

    svg.call(zoom)

    return () => {
      svg.on('.zoom', null)
    }
  }, []) // mount-only

  if (!result.found) {
    return (
      <div
        className={`rounded-md border bg-background p-8 text-center text-sm text-muted-foreground ${className ?? ''}`}
      >
        {en.pathfinding.noPathsFound}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Path summary */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {en.pathfinding.pathsFound(result.paths.length)}
        </span>
        {result.paths.map((p, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: stable order; paths don't have unique IDs
            key={i}
            className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            {en.pathfinding.hops(p.depth)}
          </span>
        ))}
      </div>

      {/* SVG container — always rendered to keep zoom listeners stable */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-md border bg-background"
        style={{ height: '500px' }}
        aria-label={en.pathfinding.ariaLabel}
        role="img"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="block"
          aria-hidden="true"
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges */}
            {simLinks.map((link, i) => {
              const source = link.source as SimNode
              const target = link.target as SimNode

              if (
                source.x === undefined ||
                source.y === undefined ||
                target.x === undefined ||
                target.y === undefined
              ) {
                return null
              }

              const strokeWidth = getStrokeWidth(link.transactionCount)
              const label = link.connectionType.replace(/_/g, ' ')

              // Midpoint for edge label
              const mx = (source.x + target.x) / 2
              const my = (source.y + target.y) / 2

              return (
                <g
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable order; no unique edge id
                  key={i}
                >
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    strokeWidth={strokeWidth}
                  />
                  <text
                    x={mx}
                    y={my}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    opacity={0.6}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                </g>
              )
            })}

            {/* Nodes */}
            {simNodes.map((node) => {
              if (node.x === undefined || node.y === undefined) return null

              const r = node.isEndpoint ? 16 : 10
              const fontSize = node.isEndpoint ? 12 : 10
              const label = node.name.length > 15 ? `${node.name.slice(0, 14)}\u2026` : node.name

              // Endpoint nodes get primary fill; intermediates get entity-type color
              type NodeColorKey = keyof typeof nodeColors
              const colorKey = node.entityType as NodeColorKey
              const fill = node.isEndpoint
                ? 'hsl(var(--primary))'
                : (colorKey in nodeColors ? nodeColors[colorKey]() : nodeColors.person())

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onClick={() => router.navigate({ to: '/entity/$id', params: { id: node.id } })}
                  onMouseEnter={(event) => setTooltip({ node, x: event.clientX, y: event.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  aria-label={`Navigate to ${node.name}`}
                >
                  <circle
                    r={r}
                    fill={fill}
                    stroke={node.isEndpoint ? 'hsl(var(--primary-foreground))' : 'none'}
                    strokeWidth={node.isEndpoint ? 2 : 0}
                    strokeOpacity={0.4}
                  />
                  <text
                    dy="1.4em"
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill="currentColor"
                    fontWeight={node.isEndpoint ? 600 : 400}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Empty state while simulation initializes */}
        {simNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && containerRef.current && (
        <PathTooltip
          tooltip={tooltip}
          simLinks={simLinks}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PathTooltip
// ---------------------------------------------------------------------------

type PathTooltipProps = {
  tooltip: NonNullable<TooltipState>
  simLinks: SimLink[]
  containerRef: React.RefObject<HTMLDivElement>
}

function PathTooltip({ tooltip, simLinks, containerRef }: PathTooltipProps) {
  const { node, x, y } = tooltip

  let connectionCount = 0
  let totalValue = 0

  for (const link of simLinks) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as SimNode).id
    const targetId = typeof link.target === 'string' ? link.target : (link.target as SimNode).id
    if (sourceId === node.id || targetId === node.id) {
      connectionCount++
      totalValue += link.totalValue ?? 0
    }
  }

  const containerRect = containerRef.current?.getBoundingClientRect()
  const left = containerRect ? x - containerRect.left + 12 : x + 12
  const top = containerRect ? y - containerRect.top - 20 : y - 20

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{ left, top }}
    >
      <div className="font-semibold">{node.name}</div>
      <div className="capitalize text-muted-foreground">{node.entityType}</div>
      <div className="mt-1">
        {connectionCount} {en.viz.graph.tooltipConnections}
      </div>
      {totalValue > 0 && (
        <div>
          {en.viz.graph.tooltipValue}: ${totalValue.toLocaleString('en-CA')}
        </div>
      )}
    </div>
  )
}
