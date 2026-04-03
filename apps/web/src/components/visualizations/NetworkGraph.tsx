import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getGraphData } from '@/server-fns/visualizations'
import { useChartColors } from '@/components/visualizations/shared/useChartColors'
import { en } from '@/i18n/en'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GraphNode = d3.SimulationNodeDatum & {
  id: string
  name: string
  entityType: 'person' | 'politician' | 'organization' | 'company' | 'department'
  depth: number
}

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  connectionType: string
  totalValue: number | null
  transactionCount: number
}

type TooltipState = {
  node: GraphNode
  x: number
  y: number
} | null

type TransformState = {
  x: number
  y: number
  k: number
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type NetworkGraphProps = {
  entityId: string
  className?: string
}

// ---------------------------------------------------------------------------
// Edge style helpers
// ---------------------------------------------------------------------------

const EDGE_DASH: Record<string, string> = {
  vendor_to_department: '6,3',
  lobbyist_to_official: '2,4',
}

function getStrokeDash(connectionType: string): string {
  return EDGE_DASH[connectionType] ?? 'none'
}

function getStrokeWidth(transactionCount: number): number {
  return Math.min(Math.log1p(transactionCount) * 1.5, 8)
}

// ---------------------------------------------------------------------------
// useNetworkGraph hook
// ---------------------------------------------------------------------------

function useNetworkGraph(entityId: string, activeTypes: string[]) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)

  const loadData = useCallback(
    async (expandId: string, existingNodes: GraphNode[]) => {
      setLoading(true)
      setError(null)

      try {
        const data = await getGraphData({
          data: {
            id: expandId,
            depth: 1,
            connectionTypes: activeTypes.length > 0 ? activeTypes : undefined,
          },
        })

        // Preserve x/y/vx/vy for already-rendered nodes (Pitfall 6)
        const positionMap = new Map(
          existingNodes.map((n) => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]),
        )

        const merged: GraphNode[] = data.nodes.map((n) => ({
          ...n,
          ...(positionMap.get(n.id) ?? {}),
        }))

        const mappedLinks: GraphLink[] = data.edges.map((e) => ({
          source: e.sourceId,
          target: e.targetId,
          connectionType: e.connectionType,
          totalValue: e.totalValue,
          transactionCount: e.transactionCount,
        }))

        setNodes(merged)
        setLinks(mappedLinks)
        setTruncated(data.truncated)
      } catch {
        setError(en.common.error)
      } finally {
        setLoading(false)
      }
    },
    [activeTypes],
  )

  // Initial load
  useEffect(() => {
    loadData(entityId, [])
  }, [entityId, loadData])

  // Simulation — restart whenever node/link count changes
  useEffect(() => {
    if (nodes.length === 0) return

    simulationRef.current?.stop()

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80),
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-200))
      .force('center', d3.forceCenter(400, 300))
      .force('collision', d3.forceCollide<GraphNode>(20))

    // Pitfall 1: function form to avoid stale closure
    sim.on('tick', () => {
      setNodes(() => [...sim.nodes()])
      setLinks(() => [...(links as GraphLink[])])
    })

    simulationRef.current = sim

    return () => {
      sim.stop()
    }
  }, [nodes.length, links.length]) // deliberately .length to avoid infinite re-runs

  const expandNode = useCallback(
    (nodeId: string) => {
      loadData(nodeId, nodes)
    },
    [loadData, nodes],
  )

  return { nodes, links, loading, error, truncated, expandNode }
}

// ---------------------------------------------------------------------------
// NetworkGraph component
// ---------------------------------------------------------------------------

export function NetworkGraph({ entityId, className }: NetworkGraphProps) {
  const [activeTypes, setActiveTypes] = useState<string[]>([])
  const { nodes, links, loading, error, truncated, expandNode } = useNetworkGraph(
    entityId,
    activeTypes,
  )
  const { nodeColors } = useChartColors()

  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [transform, setTransform] = useState<TransformState>({ x: 0, y: 0, k: 1 })
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  // Attach d3.zoom once on mount (Pitfall 2: stable SVG, never conditionally render)
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

  // Derive unique connection types from all links for filter panel
  const allConnectionTypes = Array.from(
    new Set(links.map((l) => l.connectionType)),
  ).sort()

  const toggleType = (type: string) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  return (
    <div className={className}>
      {/* Filter panel */}
      {allConnectionTypes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label={en.viz.graph.filterTitle}>
          <span className="text-sm font-medium text-muted-foreground self-center">
            {en.viz.graph.filterTitle}:
          </span>
          {allConnectionTypes.map((type) => {
            const isActive = activeTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleType(type)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {type.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>
      )}

      {/* SVG container — always rendered (Pitfall 2) */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-md border bg-background"
        style={{ height: '500px' }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          role="img"
          aria-label={en.viz.graph.ariaLabel}
          className="block"
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges */}
            {links.map((link, i) => {
              const source = link.source as GraphNode
              const target = link.target as GraphNode

              if (
                source.x === undefined ||
                source.y === undefined ||
                target.x === undefined ||
                target.y === undefined
              ) {
                return null
              }

              const dash = getStrokeDash(link.connectionType)
              const strokeWidth = getStrokeWidth(link.transactionCount)

              return (
                <line
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable order; no unique edge id
                  key={i}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="currentColor"
                  strokeOpacity={0.5}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash === 'none' ? undefined : dash}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              if (node.x === undefined || node.y === undefined) return null

              const r = node.depth === 0 ? 16 : 10
              const fontSize = node.depth === 0 ? 12 : 10
              const label =
                node.name.length > 15 ? `${node.name.slice(0, 14)}\u2026` : node.name
              const fill = nodeColors[node.entityType]()

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onClick={() => expandNode(node.id)}
                  onMouseEnter={(event) => {
                    setTooltip({ node, x: event.clientX, y: event.clientY })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}
                  aria-label={`${en.viz.graph.expandNode}: ${node.name}`}
                  role="button"
                >
                  <circle r={r} fill={fill} />
                  <text
                    dy="1.4em"
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill="currentColor"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Loading overlay — above SVG so the SVG stays stable (Pitfall 2) */}
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/70"
            aria-live="polite"
            aria-label={en.viz.graph.loadingLabel}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {en.viz.graph.emptyLabel}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Truncation warning */}
      {truncated && !loading && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {en.viz.graph.truncatedWarning}
        </div>
      )}

      {/* Tooltip — absolute-positioned outside SVG */}
      {tooltip && (
        <TooltipCard
          tooltip={tooltip}
          links={links}
          containerRef={containerRef}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TooltipCard — separate component to avoid re-renders on every tick
// ---------------------------------------------------------------------------

type TooltipCardProps = {
  tooltip: NonNullable<TooltipState>
  links: GraphLink[]
  containerRef: React.RefObject<HTMLDivElement | null>
}

function TooltipCard({ tooltip, links, containerRef }: TooltipCardProps) {
  const { node, x, y } = tooltip

  // Count connections and sum value for this node
  let connectionCount = 0
  let totalValue = 0

  for (const link of links) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
    const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id
    if (sourceId === node.id || targetId === node.id) {
      connectionCount++
      totalValue += link.totalValue ?? 0
    }
  }

  // Position relative to the viewport — use fixed so tooltip follows cursor outside SVG
  const containerRect = containerRef.current?.getBoundingClientRect()
  const left = containerRect ? x - containerRect.left + 12 : x + 12
  const top = containerRect ? y - containerRect.top - 20 : y - 20

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{ left, top }}
    >
      <div className="font-semibold">{node.name}</div>
      <div className="text-muted-foreground">{node.entityType}</div>
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
