import { Flag, Building2, User, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/entity/ConfidenceBadge'
import type { EntityProfile } from '@/server-fns/entity'
import { en } from '@/i18n/en'

type EntityHeaderProps = {
  entity: EntityProfile
  onFlagClick: () => void
}

const typeIcons: Record<string, typeof User> = {
  person: User,
  politician: Landmark,
  organization: Building2,
  company: Building2,
  department: Building2,
}

export function EntityHeader({ entity, onFlagClick }: EntityHeaderProps) {
  const bestAlias = entity.bestAlias
  const Icon = typeIcons[entity.entityType] ?? User

  return (
    <header className="relative overflow-hidden border-b bg-primary text-primary-foreground">
      {/* Subtle pattern overlay */}
      <div className="pointer-events-none absolute inset-0 gt-grid-bg opacity-10" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            {/* Type badge */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary-foreground/10">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.15em] text-primary-foreground/70">
                {entity.entityType}
              </span>
              {bestAlias && (
                <ConfidenceBadge
                  confidenceScore={bestAlias.confidenceScore}
                  matchMethod={bestAlias.matchMethod}
                  aiReasoning={bestAlias.aiReasoning}
                />
              )}
            </div>

            {/* Name */}
            <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
              {entity.canonicalName}
            </h1>
          </div>

          <Button
            variant="ghost"
            onClick={onFlagClick}
            className="h-10 shrink-0 border border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Flag className="mr-2 h-3.5 w-3.5" />
            {en.profile.flagButton}
          </Button>
        </div>
      </div>
    </header>
  )
}
