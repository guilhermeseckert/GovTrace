import type { EntityProfile } from '@/server-fns/entity'
import type { EntityAggregates } from '@/server-fns/entity-aggregates-types'
import { buildFactBlock } from '@/lib/facts'

type FactBlockProps = {
  entity: EntityProfile
  aggregates: EntityAggregates
}

// Purely presentational. SSR-safe: no effects, no browser APIs. Always renders
// the same string given the same (entity, aggregates).
export function FactBlock({ entity, aggregates }: FactBlockProps) {
  const text = buildFactBlock(entity, aggregates)
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}
