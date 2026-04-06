import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
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

        {result && !loading && (
          <div className="mt-6">
            <PathGraph result={result} />
          </div>
        )}
      </div>
    </main>
  )
}
