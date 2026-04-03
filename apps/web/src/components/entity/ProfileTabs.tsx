import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { en } from '@/i18n/en'

type TabCounts = {
  donations: number
  contracts: number
  grants: number
  lobbying: number
  connections: number
}

type TabConfig = {
  label: string
  count: number
  content: ReactNode
  disclaimer?: boolean
}

type ProfileTabsProps = {
  counts: TabCounts
  entityId: string
  donationsTable?: ReactNode
  contractsTable?: ReactNode
  grantsTable?: ReactNode
  lobbyingTable?: ReactNode
  connectionsTable?: ReactNode
  vizContent?: ReactNode
}

export function ProfileTabs({
  counts,
  donationsTable,
  contractsTable,
  grantsTable,
  lobbyingTable,
  connectionsTable,
  vizContent,
}: ProfileTabsProps) {
  const tabs: TabConfig[] = [
    {
      label: 'Donations',
      count: counts.donations,
      content: donationsTable,
    },
    {
      label: 'Contracts',
      count: counts.contracts,
      content: contractsTable,
    },
    {
      label: 'Grants',
      count: counts.grants,
      content: grantsTable,
    },
    {
      label: 'Lobbying',
      count: counts.lobbying,
      content: lobbyingTable,
    },
    {
      label: 'Connections',
      count: counts.connections,
      content: connectionsTable,
      disclaimer: true,
    },
    {
      label: 'Visualizations',
      count: 0,
      content: vizContent,
      disclaimer: true,
    },
  ]

  return (
    <Tabs defaultValue={0} className="flex w-full flex-col">
      <TabsList variant="line" className="w-full justify-start border-b">
        {tabs.map((tab, i) => (
          <TabsTrigger
            key={i}
            value={i}
            className="min-h-[44px] px-4 py-2 text-sm"
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {tab.count.toLocaleString()}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab, i) => (
        <TabsContent key={i} value={i} className="pt-6">
          {tab.disclaimer && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/20"
            >
              <Info className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{en.profile.connections_disclaimer}</span>
            </div>
          )}
          {tab.content ?? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {en.table.empty.replace('{dataset}', tab.label.toLowerCase())}
            </p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
