import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { getOrGenerateSummary } from '@/server-fns/summary'
import { en } from '@/i18n/en'

type AISummaryProps = {
  entityId: string
  initialSummary: string | null
}

export function AISummary({ entityId, initialSummary }: AISummaryProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['summary', entityId],
    queryFn: () => getOrGenerateSummary({ data: { entityId } }),
    initialData: initialSummary ?? undefined,
    staleTime: 1000 * 60 * 60, // 1 hour — summaries are cached in DB
    enabled: !initialSummary, // only fetch if no initial summary from SSR
  })

  return (
    <div className="rounded-r-md border-l-4 border-primary bg-card p-4">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-base leading-relaxed">{summary ?? 'Summary not available.'}</p>
          <div className="flex items-center justify-between">
            <p className="text-sm italic text-muted-foreground">{en.profile.disclaimer}</p>
            <button
              type="button"
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              {en.profile.summaryExplanation}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
