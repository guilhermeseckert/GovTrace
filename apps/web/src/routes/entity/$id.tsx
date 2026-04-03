import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { getEntityProfile, getEntityStats, getEntityProvenance } from '@/server-fns/entity'
// AI summary is fetched client-side by AISummary component, not in the loader
import { EntityHeader } from '@/components/entity/EntityHeader'
import { AISummary } from '@/components/entity/AISummary'
import { ProfileTabs } from '@/components/entity/ProfileTabs'
import { FlagModal } from '@/components/entity/FlagModal'
import { DonationsTable } from '@/components/tables/DonationsTable'
import { ContractsTable } from '@/components/tables/ContractsTable'
import { GrantsTable } from '@/components/tables/GrantsTable'
import { LobbyingTable } from '@/components/tables/LobbyingTable'
import { ConnectionsTable } from '@/components/tables/ConnectionsTable'
import { NetworkGraph } from '@/components/visualizations/NetworkGraph'
import { MoneyFlowSankey } from '@/components/visualizations/MoneyFlowSankey'
import { ActivityTimeline } from '@/components/visualizations/ActivityTimeline'
import { en } from '@/i18n/en'

export const Route = createFileRoute('/entity/$id')({
  loader: async ({ params }) => {
    // Don't await AI summary in loader — it calls Claude API and blocks page load.
    // The AISummary component fetches it client-side with a skeleton.
    const [profile, stats, provenance] = await Promise.all([
      getEntityProfile({ data: { id: params.id } }),
      getEntityStats({ data: { id: params.id } }),
      getEntityProvenance({ data: { id: params.id } }).catch(() => null),
    ])

    if (!profile) throw notFound()

    return { profile, stats, provenance }
  },
  notFoundComponent: () => (
    <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Entity not found</h1>
      <p className="mt-2 text-muted-foreground">
        The entity you are looking for does not exist or has been removed.
      </p>
    </main>
  ),
  errorComponent: () => (
    <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-16 text-center">
      <p className="text-muted-foreground">{en.common.error}</p>
    </main>
  ),
  pendingComponent: () => (
    <main id="main-content">
      {/* Header skeleton */}
      <div className="border-b bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-primary-foreground/10" />
              <div className="h-3 w-20 rounded bg-primary-foreground/10" />
            </div>
            <div className="h-9 w-64 rounded bg-primary-foreground/10" />
          </div>
        </div>
      </div>
      {/* Body skeleton */}
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {/* Summary skeleton */}
        <div className="space-y-3 rounded-lg border-l-4 border-primary bg-card p-5">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
          <div className="h-4 w-3/5 rounded bg-muted" />
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-4 border-b pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 rounded bg-muted" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
    </main>
  ),
  component: EntityProfilePage,
})

function VisualizationsPanel({ entityId }: { entityId: string }) {
  const [activeViz, setActiveViz] = useState<'network' | 'moneyFlow' | 'timeline'>('network')

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 border-b pb-2">
        {(['network', 'moneyFlow', 'timeline'] as const).map((vizKey) => (
          <button
            key={vizKey}
            type="button"
            role="tab"
            aria-selected={activeViz === vizKey}
            onClick={() => setActiveViz(vizKey)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              activeViz === vizKey
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {en.viz.tabs[vizKey]}
          </button>
        ))}
      </div>

      {activeViz === 'network' && <NetworkGraph entityId={entityId} />}
      {activeViz === 'moneyFlow' && <MoneyFlowSankey entityId={entityId} />}
      {activeViz === 'timeline' && <ActivityTimeline entityId={entityId} />}
    </div>
  )
}

function EntityProfilePage() {
  const { profile, stats, provenance } = Route.useLoaderData()
  const [flagModalOpen, setFlagModalOpen] = useState(false)

  return (
    <main id="main-content">
      <EntityHeader entity={profile} onFlagClick={() => setFlagModalOpen(true)} />

      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
        {/* AI Summary — first visible content below header per PROF-02 */}
        <AISummary entityId={profile.id} initialSummary={null} />

        {/* Tabbed data sections with wired DataTable components (PROF-03, PROF-04) */}
        <ProfileTabs
          counts={stats}
          entityId={profile.id}
          renderTab={(tab) => {
            switch (tab) {
              case 'donations': return <DonationsTable entityId={profile.id} />
              case 'contracts': return <ContractsTable entityId={profile.id} />
              case 'grants': return <GrantsTable entityId={profile.id} />
              case 'lobbying': return <LobbyingTable entityId={profile.id} />
              case 'connections': return <ConnectionsTable entityId={profile.id} />
              case 'visualizations': return <VisualizationsPanel entityId={profile.id} />
              default: return null
            }
          }}
        />

        {/* Data provenance — per-dataset last updated dates (PROF-06) */}
        {provenance && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
            <span className="font-medium">Last updated:</span>
            {provenance.donations && <span>Donations {new Date(provenance.donations).toISOString().slice(0, 10)}</span>}
            {provenance.contracts && <span>Contracts {new Date(provenance.contracts).toISOString().slice(0, 10)}</span>}
            {provenance.grants && <span>Grants {new Date(provenance.grants).toISOString().slice(0, 10)}</span>}
            {provenance.lobbying && <span>Lobbying {new Date(provenance.lobbying).toISOString().slice(0, 10)}</span>}
          </div>
        )}
      </div>

      <FlagModal
        entityId={profile.id}
        matchLogId={profile.matchLogId ?? undefined}
        open={flagModalOpen}
        onOpenChange={setFlagModalOpen}
      />
    </main>
  )
}
