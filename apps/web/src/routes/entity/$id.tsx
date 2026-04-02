import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { getEntityProfile, getEntityStats } from '@/server-fns/entity'
import { getOrGenerateSummary } from '@/server-fns/summary'
import { EntityHeader } from '@/components/entity/EntityHeader'
import { AISummary } from '@/components/entity/AISummary'
import { ProfileTabs } from '@/components/entity/ProfileTabs'
import { FlagModal } from '@/components/entity/FlagModal'
import { en } from '@/i18n/en'

export const Route = createFileRoute('/entity/$id')({
  loader: async ({ params }) => {
    const [profile, stats, summary] = await Promise.all([
      getEntityProfile({ data: { id: params.id } }),
      getEntityStats({ data: { id: params.id } }),
      getOrGenerateSummary({ data: { entityId: params.id } }).catch(() => null),
    ])

    if (!profile) throw notFound()

    return { profile, stats, summary }
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
      <div className="h-32 animate-pulse bg-primary" />
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <p className="text-muted-foreground">{en.profile.loading}</p>
      </div>
    </main>
  ),
  component: EntityProfilePage,
})

function EntityProfilePage() {
  const { profile, stats, summary } = Route.useLoaderData()
  const [flagModalOpen, setFlagModalOpen] = useState(false)

  // Provenance timestamps: from entity updatedAt for now
  // Plan 06 will add per-dataset ingestedAt queries
  const provenanceDate = profile.updatedAt
    ? new Date(profile.updatedAt).toISOString().slice(0, 10)
    : 'Unknown'

  return (
    <main id="main-content">
      <EntityHeader entity={profile} onFlagClick={() => setFlagModalOpen(true)} />

      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
        {/* AI Summary — first visible content below header per PROF-02 */}
        <AISummary entityId={profile.id} initialSummary={summary} />

        {/* Tabbed data sections — Plan 06 injects DataTable components */}
        <ProfileTabs counts={stats} entityId={profile.id} />

        {/* Data provenance footer — PROF-06 */}
        <footer className="border-t pt-4">
          <p className="text-sm text-muted-foreground">Last updated: {provenanceDate}</p>
        </footer>
      </div>

      <FlagModal entityId={profile.id} open={flagModalOpen} onOpenChange={setFlagModalOpen} />
    </main>
  )
}
