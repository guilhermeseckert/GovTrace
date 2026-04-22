import type { EntityProfile } from '@/server-fns/entity'
import type { EntityAggregates } from '@/server-fns/entity-aggregates-types'
import { formatAmount } from '@/lib/connection-labels'

/**
 * Pure builder for the template fact block sentence.
 *
 * Purpose: give the entity page SOMETHING grandpa-readable to render on
 * first visit, even before the Claude-generated summary is ready. It is
 * safe to call both server-side (for persistence into ai_summaries.facts_block)
 * and client-side (as a presentational fallback).
 *
 * No React, no async, no side effects. Fully deterministic for a given
 * (entity, aggregates) pair.
 */
export function buildFactBlock(entity: EntityProfile, aggregates: EntityAggregates): string {
  const parts: string[] = [`About ${entity.canonicalName}:`]
  if (entity.province) parts.push(`Based in ${entity.province}`)
  parts.push(entity.entityType)

  if (aggregates.earliestYear !== null) {
    parts.push(`First federal record: ${aggregates.earliestYear}`)
  }
  if (
    aggregates.latestYear !== null &&
    aggregates.latestYear !== aggregates.earliestYear
  ) {
    parts.push(`Most recent: ${aggregates.latestYear}`)
  }
  if (aggregates.primaryDepartment) {
    parts.push(`Primary department: ${aggregates.primaryDepartment}`)
  }
  if (aggregates.largestDeal) {
    const dept = aggregates.largestDeal.department
      ? ` with ${aggregates.largestDeal.department}`
      : ''
    parts.push(
      `Largest single ${aggregates.largestDeal.dataset}: ${formatAmount(
        String(aggregates.largestDeal.value),
      )}${dept}`,
    )
  }

  return parts.join(' · ')
}
