import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { GitBranch } from 'lucide-react'
import { findPaths } from '@/server-fns/pathfinding'
import type { PathResponse } from '@/server-fns/pathfinding'
import { PathFinder } from '@/components/pathfinding/PathFinder'
import { PathGraph } from '@/components/pathfinding/PathGraph'
import { en } from '@/i18n/en'

export const Route = createFileRoute('/find-path')({
  component: FindPathPage,
})

function FindPathPage() {
  const [result, setResult] = useState<PathResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (sourceId: string, targetId: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await findPaths({ data: { sourceId, targetId, maxDepth: 3 } })
      setResult(data)
    } catch {
      setError(en.common.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main id="main-content">
      {/* Government blue header — same style as entity page */}
      <div className="border-b bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <h1 className="font-serif text-3xl font-normal text-primary-foreground sm:text-4xl">
            {en.pathfinding.title}
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/70">
            {en.pathfinding.subtitle}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <PathFinder onSearch={handleSearch} loading={loading} />

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="mt-8 rounded-lg border border-dashed p-10 text-center">
            <GitBranch className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              Find the shortest path between two people or organisations
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for any two entities above — a politician, a company, a lobbyist — and
              GovTrace will trace the chain of donations, contracts, and lobbying meetings
              that connects them.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full border px-3 py-1">Politician → Donor</span>
              <span className="rounded-full border px-3 py-1">Lobbyist → Contract</span>
              <span className="rounded-full border px-3 py-1">Company → Party</span>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="mt-6">
            <PathGraph result={result} />
          </div>
        )}
      </div>
    </main>
  )
}
