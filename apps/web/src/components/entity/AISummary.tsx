import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getOrGenerateSummary } from '@/server-fns/summary'
import { AISummaryExplanation } from '@/components/entity/AISummaryExplanation'
import { en } from '@/i18n/en'

type AISummaryProps = {
  entityId: string
  initialSummary: string | null
}

export function AISummary({ entityId, initialSummary }: AISummaryProps) {
  const [explanationOpen, setExplanationOpen] = useState(false)

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['summary', entityId],
    queryFn: () => getOrGenerateSummary({ data: { entityId } }),
    initialData: initialSummary ?? undefined,
    staleTime: 1000 * 60 * 60,
    enabled: !initialSummary, // fetch client-side if SSR didn't provide one
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Generating AI summary...</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    )
  }

  if (!summary || isError) {
    return null // Don't show the summary card at all if unavailable
  }

  return (
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
  )
}
