import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import type { EntityProfile } from '@/server-fns/entity'
import type { EntityAggregates } from '@/server-fns/entity-aggregates-types'
import { getOrGenerateSummary } from '@/server-fns/summary'
import { AISummaryExplanation } from '@/components/entity/AISummaryExplanation'
import { FactBlock } from '@/components/entity/FactBlock'
import { en } from '@/i18n/en'

type AISummaryProps = {
  entityId: string
  initialSummary: string | null
  entity?: EntityProfile
  aggregates?: EntityAggregates | null
}

export function AISummary({ entityId, initialSummary, entity, aggregates }: AISummaryProps) {
  const [explanationOpen, setExplanationOpen] = useState(false)

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['summary', entityId],
    queryFn: () => getOrGenerateSummary({ data: { entityId } }),
    initialData: initialSummary ?? undefined,
    staleTime: 1000 * 60 * 60,
    enabled: !initialSummary, // fetch client-side if SSR didn't provide one
    retry: 1,
  })

  const canShowFacts = Boolean(entity && aggregates)

  // While the AI summary is generating, show FactBlock as the primary content
  // so the user NEVER sees "Generating..." as the only thing on screen.
  if (isLoading) {
    if (canShowFacts && entity && aggregates) {
      return (
        <div className="space-y-3">
          <FactBlock entity={entity} aggregates={aggregates} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI summary loading…</span>
          </p>
        </div>
      )
    }
    // No aggregates available — legacy skeleton path (should be rare after Task 4)
    return (
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI summary loading…</span>
        </div>
      </div>
    )
  }

  // AI summary absent or failed: fall back to FactBlock alone.
  if (!summary || isError) {
    if (canShowFacts && entity && aggregates) {
      return <FactBlock entity={entity} aggregates={aggregates} />
    }
    return null
  }

  // AI summary ready: render it above FactBlock as corroborating facts.
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-l-4 border-primary bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI-generated from public records</span>
        </div>
        <p className="text-base leading-relaxed">{summary}</p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs italic text-muted-foreground">{en.profile.disclaimer}</p>
          <button
            type="button"
            onClick={() => setExplanationOpen(true)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {en.profile.summaryExplanation}
          </button>
          <AISummaryExplanation open={explanationOpen} onOpenChange={setExplanationOpen} />
        </div>
      </div>
      {canShowFacts && entity && aggregates && (
        <FactBlock entity={entity} aggregates={aggregates} />
      )}
    </div>
  )
}
