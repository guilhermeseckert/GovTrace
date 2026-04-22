import type { EntityProfile } from '@/server-fns/entity'
import type { EntityAggregates } from '@/server-fns/entity-aggregates'
import { formatAmount } from '@/lib/connection-labels'

type CategoryTotal = {
  key: 'donations' | 'contracts' | 'grants' | 'aid'
  total: number
  count: number
  label: string
  verb: string
}

function buildCategories(entity: EntityProfile, aggregates: EntityAggregates): CategoryTotal[] {
  const isPolitician = entity.entityType === 'politician'
  const categories: CategoryTotal[] = []

  if (isPolitician) {
    // Politicians RECEIVE donations — that is the primary signal
    categories.push({
      key: 'donations',
      total: aggregates.donationsTotal,
      count: aggregates.donationsCount,
      label: 'in political donations received',
      verb: 'received',
    })
    if (aggregates.contractsTotal > 0) {
      categories.push({
        key: 'contracts',
        total: aggregates.contractsTotal,
        count: aggregates.contractsCount,
        label: 'in federal contracts',
        verb: 'linked to',
      })
    }
  } else {
    if (aggregates.contractsTotal > 0) {
      categories.push({
        key: 'contracts',
        total: aggregates.contractsTotal,
        count: aggregates.contractsCount,
        label: 'in federal contracts',
        verb: 'got',
      })
    }
    if (aggregates.grantsTotal > 0) {
      categories.push({
        key: 'grants',
        total: aggregates.grantsTotal,
        count: aggregates.grantsCount,
        label: 'in federal grants',
        verb: 'got',
      })
    }
    if (aggregates.aidTotal > 0) {
      categories.push({
        key: 'aid',
        total: aggregates.aidTotal,
        count: aggregates.aidCount,
        label: 'in international aid disbursements',
        verb: 'received',
      })
    }
    if (aggregates.donationsTotal > 0) {
      categories.push({
        key: 'donations',
        total: aggregates.donationsTotal,
        count: aggregates.donationsCount,
        label: 'in political donations made',
        verb: 'donated',
      })
    }
  }

  return categories.sort((a, b) => b.total - a.total)
}

function formatSecondary(aggregates: EntityAggregates, winnerKey: CategoryTotal['key']): string[] {
  const parts: string[] = []
  if (winnerKey !== 'grants' && aggregates.grantsTotal > 0) {
    parts.push(`${formatAmount(String(aggregates.grantsTotal))} in grants`)
  }
  if (winnerKey !== 'contracts' && aggregates.contractsTotal > 0) {
    parts.push(`${formatAmount(String(aggregates.contractsTotal))} in contracts`)
  }
  if (winnerKey !== 'aid' && aggregates.aidTotal > 0) {
    parts.push(`${formatAmount(String(aggregates.aidTotal))} in international aid`)
  }
  if (aggregates.lobbyingCount > 0) {
    parts.push(`${aggregates.lobbyingCount.toLocaleString()} lobbying registrations`)
  }
  if (winnerKey !== 'donations' && aggregates.donationsCount > 0) {
    parts.push(`${aggregates.donationsCount.toLocaleString()} political donations`)
  }
  return parts
}

type EntityHeroProps = {
  entity: EntityProfile
  aggregates: EntityAggregates
}

export function EntityHero({ entity, aggregates }: EntityHeroProps) {
  const categories = buildCategories(entity, aggregates)
  const winner = categories[0]

  const hasAnyActivity =
    aggregates.contractsCount > 0 ||
    aggregates.grantsCount > 0 ||
    aggregates.donationsCount > 0 ||
    aggregates.lobbyingCount > 0 ||
    aggregates.aidCount > 0

  if (!hasAnyActivity || !winner || winner.total <= 0) {
    return (
      <section aria-labelledby="entity-hero-heading" className="rounded-lg border bg-card p-6">
        <h2 id="entity-hero-heading" className="font-serif text-2xl text-muted-foreground">
          This entity has no recorded federal activity yet.
        </h2>
      </section>
    )
  }

  const secondary = formatSecondary(aggregates, winner.key)
  const year = aggregates.earliestYear

  return (
    <section aria-labelledby="entity-hero-heading" className="rounded-lg border bg-card p-6">
      <h2 id="entity-hero-heading" className="font-serif text-3xl leading-tight sm:text-4xl">
        {entity.canonicalName} {winner.verb}{' '}
        <span className="font-semibold">{formatAmount(String(winner.total))}</span> {winner.label}
      </h2>
      {(winner.count > 0 || year !== null) && (
        <p className="mt-2 text-sm text-muted-foreground">
          {winner.count > 0 && (
            <>across {winner.count.toLocaleString()} records</>
          )}
          {winner.count > 0 && year !== null && ' '}
          {year !== null && <>since {year}</>}
          {aggregates.primaryDepartment && (
            <>
              {' · '}primarily via {aggregates.primaryDepartment}
            </>
          )}
        </p>
      )}
      {secondary.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Also: {secondary.join(' · ')}
        </p>
      )}
    </section>
  )
}
