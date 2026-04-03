import { useEffect, useState } from 'react'
import { DollarSign, FileText, Gift, Users } from 'lucide-react'
import { getTimeline } from '@/server-fns/visualizations'
import type { TimelineEvent } from '@/server-fns/visualizations'
import { en } from '@/i18n/en'

type ActivityTimelineProps = {
  entityId: string
  className?: string
}

const EVENT_CONFIG = {
  donation: { icon: DollarSign, color: 'bg-blue-500', label: 'Donation' },
  contract: { icon: FileText, color: 'bg-emerald-500', label: 'Contract' },
  grant: { icon: Gift, color: 'bg-amber-500', label: 'Grant' },
  lobby_registration: { icon: Users, color: 'bg-purple-500', label: 'Lobby Reg.' },
  lobby_communication: { icon: Users, color: 'bg-pink-500', label: 'Lobby Comm.' },
} as const

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ActivityTimeline({ entityId, className }: ActivityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getTimeline({ data: { id: entityId } })
      .then((r) => setEvents(r.events))
      .catch(() => setError(en.common.error))
      .finally(() => setLoading(false))
  }, [entityId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading timeline...
      </div>
    )
  }

  if (error) {
    return <div className="flex h-64 items-center justify-center text-sm text-destructive">{error}</div>
  }

  if (events.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {en.viz.timeline.emptyLabel}
      </p>
    )
  }

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${cfg.color}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Event list */}
      <div className="max-h-[500px] space-y-0.5 overflow-y-auto">
        {events.map((event, i) => {
          const cfg = EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.donation
          const Icon = cfg.icon

          return (
            <div
              key={`${event.date}-${event.eventType}-${i}`}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              <span className="w-24 shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatDate(event.date)}
              </span>
              <span className="flex-1 truncate">{event.description}</span>
              {event.amount !== null && event.amount > 0 && (
                <span className="shrink-0 tabular-nums text-xs font-medium">
                  {formatAmount(event.amount)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
