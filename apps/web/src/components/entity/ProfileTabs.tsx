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

type ProfileTabsProps = {
  counts: TabCounts
  entityId: string
  donationsTable?: ReactNode
  contractsTable?: ReactNode
  grantsTable?: ReactNode
  lobbyingTable?: ReactNode
  connectionsTable?: ReactNode
}

export function ProfileTabs({
  counts,
  entityId: _entityId,
  donationsTable,
  contractsTable,
  grantsTable,
  lobbyingTable,
  connectionsTable,
}: ProfileTabsProps) {
  return (
    <Tabs defaultValue="donations" className="w-full">
      <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0">
        {[
          { value: 'donations', label: 'Donations', count: counts.donations },
          { value: 'contracts', label: 'Contracts', count: counts.contracts },
          { value: 'grants', label: 'Grants', count: counts.grants },
          { value: 'lobbying', label: 'Lobbying', count: counts.lobbying },
          { value: 'connections', label: 'Connections', count: counts.connections },
        ].map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="min-h-[44px] rounded-none border-b-2 border-transparent px-4 py-2 font-normal data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none"
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="ml-2">
                {tab.count}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="donations" className="pt-6">
        {donationsTable ?? (
          <p className="text-sm text-muted-foreground">
            {en.table.empty.replace('{dataset}', 'donation')}
          </p>
        )}
      </TabsContent>

      <TabsContent value="contracts" className="pt-6">
        {contractsTable ?? (
          <p className="text-sm text-muted-foreground">
            {en.table.empty.replace('{dataset}', 'contract')}
          </p>
        )}
      </TabsContent>

      <TabsContent value="grants" className="pt-6">
        {grantsTable ?? (
          <p className="text-sm text-muted-foreground">
            {en.table.empty.replace('{dataset}', 'grant')}
          </p>
        )}
      </TabsContent>

      <TabsContent value="lobbying" className="pt-6">
        {lobbyingTable ?? (
          <p className="text-sm text-muted-foreground">
            {en.table.empty.replace('{dataset}', 'lobbying')}
          </p>
        )}
      </TabsContent>

      <TabsContent value="connections" className="pt-6">
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/20"
        >
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{en.profile.connections_disclaimer}</span>
        </div>
        {connectionsTable ?? (
          <p className="text-sm text-muted-foreground">
            {en.table.empty.replace('{dataset}', 'connections')}
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
