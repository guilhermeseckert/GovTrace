import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Lightbulb } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getPatternCallouts } from '@/server-fns/patterns'

type PatternCalloutsProps = {
  entityId: string
}

export function PatternCallouts({ entityId }: PatternCalloutsProps) {
  const { data: callouts, isLoading, isError } = useQuery({
    queryKey: ['pattern-callouts', entityId],
    queryFn: () => getPatternCallouts({ data: { entityId } }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-l-4 border-l-amber-400 bg-amber-50 p-4 dark:bg-amber-950/20">
          <Skeleton className="mb-2 h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    )
  }

  if (isError || !callouts || callouts.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {callouts.map((callout) => (
        <div
          key={callout.id}
          className="rounded-lg border border-l-4 border-l-amber-400 bg-amber-50 p-4 dark:bg-amber-950/20"
        >
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Did you know?</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{callout.question}</p>
          <p className="mt-1 text-xs text-muted-foreground">{callout.whyItMatters}</p>
          {callout.sourceEntityId && callout.sourceEntityId !== entityId && (
            <Link
              to="/entity/$id"
              params={{ id: callout.sourceEntityId }}
              className="mt-2 inline-block text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
            >
              View source records
            </Link>
          )}
        </div>
      ))}
      <Link
        to="/patterns"
        search={{ entity: entityId }}
        className="inline-block text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        View all patterns for this entity
      </Link>
    </div>
  )
}
