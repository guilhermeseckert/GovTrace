import { useEffect, useState } from 'react'
import { getMoneyFlow } from '@/server-fns/visualizations'
import type { MoneyFlowNode, MoneyFlowLink } from '@/server-fns/visualizations'
import { en } from '@/i18n/en'

type MoneyFlowSankeyProps = {
  entityId: string
  className?: string
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function MoneyFlowSankey({ entityId, className }: MoneyFlowSankeyProps) {
  const [nodes, setNodes] = useState<MoneyFlowNode[]>([])
  const [links, setLinks] = useState<MoneyFlowLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getMoneyFlow({ data: { id: entityId } })
      .then((r) => { setNodes(r.nodes); setLinks(r.links) })
      .catch(() => setError(en.common.error))
      .finally(() => setLoading(false))
  }, [entityId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading money flow...
      </div>
    )
  }

  if (error) {
    return <div className="flex h-64 items-center justify-center text-sm text-destructive">{error}</div>
  }

  if (nodes.length < 3 || links.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {en.viz.sankey.emptyLabel}
      </p>
    )
  }

  // Find the root node and connected nodes
  const rootNode = nodes.find((n) => n.id === 'root')
  const otherNodes = nodes.filter((n) => n.id !== 'root')
  const maxValue = Math.max(...links.map((l) => l.value))

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Top donors → {rootNode?.name ?? 'Entity'}
      </div>
      <div className="space-y-1.5">
        {otherNodes.map((node) => {
          const link = links.find((l) => l.source === node.id || l.target === node.id)
          const value = link?.value ?? 0
          const pct = maxValue > 0 ? (value / maxValue) * 100 : 0

          return (
            <div key={node.id} className="group flex items-center gap-3">
              <div className="w-48 truncate text-sm" title={node.name}>
                {node.name}
              </div>
              <div className="flex-1">
                <div className="h-6 w-full rounded-sm bg-muted/50">
                  <div
                    className="flex h-full items-center rounded-sm bg-primary/80 px-2 text-xs text-primary-foreground transition-all"
                    style={{ width: `${Math.max(pct, 8)}%` }}
                  >
                    {formatAmount(value)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
