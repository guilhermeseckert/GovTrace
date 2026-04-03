import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { en } from '@/i18n/en'

type TabCounts = {
  donations: number
  contracts: number
  grants: number
  lobbying: number
  connections: number
}

export type TabKey = 'donations' | 'contracts' | 'grants' | 'lobbying' | 'connections' | 'visualizations'

type ProfileTabsProps = {
  counts: TabCounts
  entityId: string
  renderTab: (tab: TabKey) => ReactNode
}

type TabDef = {
  key: TabKey
  label: string
  count: number
  disclaimer?: boolean
}

const TABS: TabDef[] = [
  { key: 'donations', label: 'Donations', count: 0 },
  { key: 'contracts', label: 'Contracts', count: 0 },
  { key: 'grants', label: 'Grants', count: 0 },
  { key: 'lobbying', label: 'Lobbying', count: 0 },
  { key: 'connections', label: 'Connections', count: 0, disclaimer: true },
  { key: 'visualizations', label: 'Visualizations', count: 0, disclaimer: true },
]

export function ProfileTabs({ counts, renderTab }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('donations')

  const tabs = TABS.map((t) => ({
    ...t,
    count: (counts as Record<string, number>)[t.key] ?? 0,
  }))

  const activeDef = tabs.find((t) => t.key === activeTab)

  return (
    <div className="flex w-full flex-col">
      {/* Tab bar */}
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {tab.count.toLocaleString()}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Active tab content — ONLY the selected tab renders (lazy) */}
      <div className="pt-6">
        {activeDef?.disclaimer && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/20"
          >
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{en.profile.connections_disclaimer}</span>
          </div>
        )}
        {renderTab(activeTab)}
      </div>
    </div>
  )
}
