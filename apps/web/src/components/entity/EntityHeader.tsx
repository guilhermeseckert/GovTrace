import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/entity/ConfidenceBadge'
import type { EntityProfile } from '@/server-fns/entity'
import { en } from '@/i18n/en'

type EntityHeaderProps = {
  entity: EntityProfile
  onFlagClick: () => void
}

export function EntityHeader({ entity, onFlagClick }: EntityHeaderProps) {
  const bestAlias = entity.bestAlias

  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-[1.15]">{entity.canonicalName}</h1>
            {bestAlias && (
              <ConfidenceBadge
                confidenceScore={bestAlias.confidenceScore}
                matchMethod={bestAlias.matchMethod}
                aiReasoning={bestAlias.aiReasoning}
              />
            )}
          </div>
          <p className="text-sm capitalize opacity-80">{entity.entityType}</p>
        </div>
        <Button
          variant="ghost"
          onClick={onFlagClick}
          className="h-11 shrink-0 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
        >
          <Flag className="mr-2 h-4 w-4" />
          {en.profile.flagButton}
        </Button>
      </div>
    </header>
  )
}
