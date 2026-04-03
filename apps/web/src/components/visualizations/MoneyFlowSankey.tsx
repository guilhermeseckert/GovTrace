import { useEffect, useMemo, useRef, useState } from 'react'
import { sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey'
import type { SankeyNode as D3SankeyNode, SankeyLink as D3SankeyLink } from 'd3-sankey'
import { getMoneyFlow } from '@/server-fns/visualizations'
import type { MoneyFlowNode, MoneyFlowLink } from '@/server-fns/visualizations'
import { useChartColors } from '@/components/visualizations/shared/useChartColors'
import { useResizeObserver } from '@/components/visualizations/shared/useResizeObserver'
import { en } from '@/i18n/en'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SankeyNodeData = MoneyFlowNode
type SankeyLinkData = MoneyFlowLink
type ComputedNode = D3SankeyNode<SankeyNodeData, SankeyLinkData>
type ComputedLink = D3SankeyLink<SankeyNodeData, SankeyLinkData>

type MoneyFlowSankeyProps = {
  entityId: string
  className?: string
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 }
const HEIGHT = 400

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MoneyFlowSankey({ entityId, className }: MoneyFlowSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useResizeObserver(containerRef)
  const { getColor } = useChartColors()

  const [rawNodes, setRawNodes] = useState<MoneyFlowNode[]>([])
  const [rawLinks, setRawLinks] = useState<MoneyFlowLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch data on entityId change
  useEffect(() => {
    setLoading(true)
    setError(null)

    getMoneyFlow({ data: { id: entityId } })
      .then((response) => {
        console.log('[MoneyFlow] Got data:', response.nodes.length, 'nodes,', response.links.length, 'links')
        setRawNodes(response.nodes)
        setRawLinks(response.links)
      })
      .catch((err) => {
        console.error('[MoneyFlow] Error:', err)
        setError(en.common.error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [entityId])

  // Resolve node color by type
  const nodeColor = useMemo(
    () =>
      (type: 'entity' | 'party' | 'department'): string => {
        if (type === 'entity') return getColor('--primary')
        if (type === 'party') return getColor('--accent-foreground')
        return getColor('--ring')
      },
    [getColor],
  )

  // Compute Sankey layout (deep-copy to avoid d3-sankey mutation of state — Pitfall 4)
  const layout = useMemo<{ nodes: ComputedNode[]; links: ComputedLink[] } | null>(() => {
    if (rawNodes.length < 3 || width === 0) return null

    const sankeyLayout = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeWidth(20)
      .nodePadding(12)
      .nodeId((d) => d.id)
      .nodeAlign(sankeyLeft)
      .extent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, HEIGHT - MARGIN.bottom],
      ])

    const { nodes: computedNodes, links: computedLinks } = sankeyLayout({
      nodes: rawNodes.map((n) => ({ ...n })),
      links: rawLinks.map((l) => ({ ...l })),
    })

    return { nodes: computedNodes, links: computedLinks }
  }, [rawNodes, rawLinks, width])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        {en.viz.sankey.loadingLabel}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center text-destructive">
        {error}
      </div>
    )
  }

  // Empty state — server returns { nodes: [], links: [] } when < 3 nodes
  if (rawNodes.length < 3) {
    return (
      <p className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
        {en.viz.sankey.emptyLabel}
      </p>
    )
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ''}`} style={{ height: HEIGHT }}>
      {layout && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={en.viz.sankey.ariaLabel}
        >
          {/* Sankey links */}
          {layout.links.map((link, i) => {
            const sourceNode = link.source as ComputedNode
            const sourceType = (sourceNode as unknown as SankeyNodeData).type
            const color = nodeColor(sourceType)
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: Sankey links have no stable ID; index is safe here
                key={i}
                d={sankeyLinkHorizontal()(link) ?? ''}
                fill="none"
                stroke={color}
                strokeWidth={Math.max(1, link.width ?? 0)}
                strokeOpacity={0.4}
              />
            )
          })}

          {/* Sankey node rectangles and labels */}
          {layout.nodes.map((node) => {
            const x0 = node.x0 ?? 0
            const x1 = node.x1 ?? 0
            const y0 = node.y0 ?? 0
            const y1 = node.y1 ?? 0
            const midY = (y0 + y1) / 2
            const nodeType = (node as unknown as SankeyNodeData).type
            const color = nodeColor(nodeType)
            const label = node.name.length > 20 ? `${node.name.slice(0, 20)}\u2026` : node.name

            return (
              <g key={node.id}>
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={Math.max(1, y1 - y0)}
                  fill={color}
                  rx={2}
                />
                <text
                  x={x1 + 4}
                  y={midY}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="currentColor"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
