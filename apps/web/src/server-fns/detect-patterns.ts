import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { patternFlags } from '@govtrace/db/schema/entities'

// Pattern detection constants
const TEMPORAL_WINDOW_DAYS = 90
const DONATION_SPIKE_MULTIPLIER = 2
const DONATION_HIGH_SEVERITY_MULTIPLIER = 5
const LOBBYING_CLUSTER_MEDIUM_THRESHOLD = 3
const LOBBYING_CLUSTER_HIGH_THRESHOLD = 5
const CAUSATION_CAVEAT =
  'Temporal proximity does not imply a causal relationship. This pattern is flagged for transparency.'

type DbInstance = ReturnType<typeof getDb>

function formatCad(value: string | number): string {
  const n = Number(value)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// --- Detection algorithm 1: donation spike near contract ---
async function detectDonationSpikes(db: DbInstance): Promise<void> {
  const rows = await db.execute<{
    entity_id: string
    donation_id: string
    contract_id: string
    donation_amount: string
    avg_donation: string
    donation_date: string
    award_date: string
    days_apart: string
  }>(sql`
    SELECT
      d.entity_id,
      d.id AS donation_id,
      c.id AS contract_id,
      d.amount::text AS donation_amount,
      avg_d.avg_amount::text AS avg_donation,
      d.donation_date::text AS donation_date,
      c.award_date::text AS award_date,
      ABS(c.award_date - d.donation_date)::text AS days_apart
    FROM donations d
    JOIN contracts c ON c.entity_id = d.entity_id
    JOIN (
      SELECT entity_id, AVG(amount) AS avg_amount
      FROM donations
      WHERE entity_id IS NOT NULL
      GROUP BY entity_id
    ) avg_d ON avg_d.entity_id = d.entity_id
    WHERE d.entity_id IS NOT NULL
      AND c.entity_id IS NOT NULL
      AND ABS(c.award_date - d.donation_date) <= ${TEMPORAL_WINDOW_DAYS}
      AND d.amount > avg_d.avg_amount * ${DONATION_SPIKE_MULTIPLIER}
    ORDER BY d.amount DESC
    LIMIT 500
  `)

  for (const row of Array.from(rows)) {
    const donationAmt = Number(row.donation_amount)
    const avgAmt = Number(row.avg_donation)
    const severity =
      donationAmt > avgAmt * DONATION_HIGH_SEVERITY_MULTIPLIER ? 'high' : 'medium'
    const daysPart = Number(row.days_apart)
    const title = `Donated ${formatCad(donationAmt)} within ${String(daysPart)} days of contract award`
    const description = [
      `A donation of ${formatCad(donationAmt)} (made on ${row.donation_date}) occurred within ${String(daysPart)} days`,
      `of a government contract award (awarded on ${row.award_date}).`,
      `The entity's average donation is ${formatCad(row.avg_donation)}.`,
      CAUSATION_CAVEAT,
    ].join(' ')

    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id,
        patternType: 'donation_spike_near_contract',
        severity,
        title,
        description,
        evidenceRecordIds: [row.donation_id, row.contract_id],
        evidenceTables: ['donations', 'contracts'],
        timeWindowStart: row.donation_date < row.award_date ? row.donation_date : row.award_date,
        timeWindowEnd: row.donation_date > row.award_date ? row.donation_date : row.award_date,
        detectedValue: row.donation_amount,
      })
    } catch {
      // Skip duplicates silently (unique constraints not enforced here — deduplication is by design)
    }
  }
}

// --- Detection algorithm 2: lobbying cluster before contract ---
async function detectLobbyingClusters(db: DbInstance): Promise<void> {
  const rows = await db.execute<{
    entity_id: string
    communication_ids: string
    communication_count: string
    award_date: string
    window_start: string
    contract_id: string
    contract_value: string
  }>(sql`
    SELECT
      lr.client_entity_id AS entity_id,
      STRING_AGG(lc.id, ',' ORDER BY lc.communication_date) AS communication_ids,
      COUNT(lc.id)::text AS communication_count,
      c.award_date::text AS award_date,
      (c.award_date - ${TEMPORAL_WINDOW_DAYS})::text AS window_start,
      c.id AS contract_id,
      c.value::text AS contract_value
    FROM lobby_registrations lr
    JOIN lobby_communications lc ON lc.registration_number = lr.registration_number
    JOIN contracts c ON c.entity_id = lr.client_entity_id
    WHERE lr.client_entity_id IS NOT NULL
      AND c.award_date IS NOT NULL
      AND lc.communication_date BETWEEN c.award_date - ${TEMPORAL_WINDOW_DAYS} AND c.award_date
    GROUP BY lr.client_entity_id, c.id, c.award_date, c.value
    HAVING COUNT(lc.id) >= ${LOBBYING_CLUSTER_MEDIUM_THRESHOLD}
    ORDER BY COUNT(lc.id) DESC
    LIMIT 300
  `)

  for (const row of Array.from(rows)) {
    const commCount = Number(row.communication_count)
    const severity = commCount >= LOBBYING_CLUSTER_HIGH_THRESHOLD ? 'high' : 'medium'
    const contractValStr = row.contract_value ? ` (value: ${formatCad(row.contract_value)})` : ''
    const title = `${String(commCount)} lobbying communications in ${String(TEMPORAL_WINDOW_DAYS)} days before contract award`
    const description = [
      `${String(commCount)} registered lobby communications were filed between ${row.window_start} and ${row.award_date},`,
      `the 90-day window preceding a contract award${contractValStr}.`,
      CAUSATION_CAVEAT,
    ].join(' ')

    const commIds = row.communication_ids.split(',')

    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id,
        patternType: 'lobbying_cluster_before_contract',
        severity,
        title,
        description,
        evidenceRecordIds: [...commIds, row.contract_id],
        evidenceTables: ['lobby_communications', 'contracts'],
        timeWindowStart: row.window_start,
        timeWindowEnd: row.award_date,
      })
    } catch {
      // Skip duplicates silently
    }
  }
}

// --- Detection algorithm 3: outlier contribution ---
async function detectOutlierContributions(db: DbInstance): Promise<void> {
  const rows = await db.execute<{
    donation_id: string
    entity_id: string
    amount: string
    contributor_type: string
    p99: string
    p999: string
    donation_date: string
    recipient_name: string
  }>(sql`
    WITH percentiles AS (
      SELECT
        contributor_type,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY amount::numeric) AS p99,
        PERCENTILE_CONT(0.999) WITHIN GROUP (ORDER BY amount::numeric) AS p999
      FROM donations
      WHERE entity_id IS NOT NULL
        AND contributor_type IS NOT NULL
      GROUP BY contributor_type
    )
    SELECT
      d.id AS donation_id,
      d.entity_id,
      d.amount::text AS amount,
      d.contributor_type,
      p.p99::text AS p99,
      p.p999::text AS p999,
      d.donation_date::text AS donation_date,
      d.recipient_name
    FROM donations d
    JOIN percentiles p ON p.contributor_type = d.contributor_type
    WHERE d.entity_id IS NOT NULL
      AND d.amount::numeric > p.p99
    ORDER BY d.amount::numeric DESC
    LIMIT 300
  `)

  for (const row of Array.from(rows)) {
    const amt = Number(row.amount)
    const p999 = Number(row.p999)
    const severity = amt > p999 ? 'high' : 'medium'
    const threshold = severity === 'high' ? 'top 0.1%' : 'top 1%'

    const title = `${formatCad(amt)} donation places this entity in the ${threshold} of ${row.contributor_type ?? 'contributor'} donors`
    const description = [
      `A donation of ${formatCad(amt)} was made on ${row.donation_date} to ${row.recipient_name}.`,
      `This amount is in the ${threshold} of all donations by ${row.contributor_type ?? 'this contributor type'}.`,
      `The 99th percentile threshold for this contributor type is ${formatCad(row.p99)}.`,
      CAUSATION_CAVEAT,
    ].join(' ')

    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id,
        patternType: 'outlier_contribution',
        severity,
        title,
        description,
        evidenceRecordIds: [row.donation_id],
        evidenceTables: ['donations'],
        timeWindowStart: row.donation_date,
        timeWindowEnd: row.donation_date,
        detectedValue: row.amount,
      })
    } catch {
      // Skip duplicates silently
    }
  }
}

const DONATION_HIGH_SEVERITY_AMOUNT = 1000
const APPOINTMENT_SHORT_WINDOW_DAYS = 90

// --- Detection algorithm 4: donation before appointment ---
async function detectDonationBeforeAppointment(db: DbInstance): Promise<void> {
  const rows = await db.execute<{
    entity_id: string
    donation_id: string
    appointment_id: string
    donation_amount: string
    donation_date: string
    recipient_name: string
    appointment_date: string
    organization_name: string
    position_title: string
    days_before: string
  }>(sql`
    SELECT
      d.entity_id,
      d.id AS donation_id,
      ga.id AS appointment_id,
      d.amount::text AS donation_amount,
      d.donation_date::text AS donation_date,
      d.recipient_name,
      ga.appointment_date::text AS appointment_date,
      ga.organization_name,
      ga.position_title,
      (ga.appointment_date - d.donation_date)::text AS days_before
    FROM donations d
    JOIN gic_appointments ga ON ga.entity_id = d.entity_id
    WHERE d.entity_id IS NOT NULL
      AND d.donation_date < ga.appointment_date
      AND (ga.appointment_date - d.donation_date) <= 365
      AND ga.is_vacant = false
    ORDER BY d.amount::numeric DESC
    LIMIT 500
  `)

  for (const row of Array.from(rows)) {
    const amount = Number(row.donation_amount)
    const daysBefore = Number(row.days_before)
    const isHighSeverity = amount > DONATION_HIGH_SEVERITY_AMOUNT && daysBefore <= APPOINTMENT_SHORT_WINDOW_DAYS
    const severity = isHighSeverity ? 'high' : 'medium'

    const title = `Donated ${formatCad(amount)} to ${row.recipient_name} ${String(daysBefore)} days before appointment to ${row.organization_name}`
    const description = [
      `A donation of ${formatCad(amount)} was made to ${row.recipient_name} on ${row.donation_date},`,
      `${String(daysBefore)} days before an appointment to ${row.organization_name} as ${row.position_title} on ${row.appointment_date}.`,
      CAUSATION_CAVEAT,
    ].join(' ')

    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id,
        patternType: 'donation_before_appointment',
        severity,
        title,
        description,
        evidenceRecordIds: [row.donation_id, row.appointment_id],
        evidenceTables: ['donations', 'gic_appointments'],
        timeWindowStart: row.donation_date,
        timeWindowEnd: row.appointment_date,
        detectedValue: row.donation_amount,
      })
    } catch {
      // Skip duplicates silently
    }
  }
}

// --- Server function: run all detection algorithms ---
export const detectPatterns = createServerFn({ method: 'POST' })
  .handler(async (): Promise<{ inserted: number }> => {
    const db = getDb()
    const before = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM pattern_flags`
    )
    const countBefore = Number(Array.from(before)[0]?.count ?? 0)

    await detectDonationSpikes(db)
    await detectLobbyingClusters(db)
    await detectOutlierContributions(db)
    await detectDonationBeforeAppointment(db)

    const after = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM pattern_flags`
    )
    const countAfter = Number(Array.from(after)[0]?.count ?? 0)

    return { inserted: countAfter - countBefore }
  })

// --- Server function: paginated patterns feed ---
export type PatternFeedItem = {
  id: string
  entityId: string
  entityName: string
  patternType: string
  severity: string
  title: string
  description: string
  relatedEntityId: string | null
  relatedEntityName: string | null
  detectedAt: string
  detectedValue: string | null
}

export const getPatternsFeed = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(50),
      patternType: z.string().optional(),
      entityId: z.string().uuid().optional(),
    })
  )
  .handler(async ({ data }): Promise<{ items: PatternFeedItem[]; total: number }> => {
    const db = getDb()

    const typeFilter = data.patternType
      ? sql` AND pf.pattern_type = ${data.patternType}`
      : sql``

    const entityFilter = data.entityId
      ? sql` AND pf.entity_id = ${data.entityId}`
      : sql``

    const rows = await db.execute<{
      id: string
      entity_id: string
      entity_name: string
      pattern_type: string
      severity: string
      title: string
      description: string
      related_entity_id: string | null
      related_entity_name: string | null
      detected_at: string
      detected_value: string | null
    }>(sql`
      SELECT
        pf.id,
        pf.entity_id,
        e.canonical_name AS entity_name,
        pf.pattern_type,
        pf.severity,
        pf.title,
        pf.description,
        pf.related_entity_id,
        re.canonical_name AS related_entity_name,
        pf.detected_at::text AS detected_at,
        pf.detected_value::text AS detected_value
      FROM pattern_flags pf
      JOIN entities e ON e.id = pf.entity_id
      LEFT JOIN entities re ON re.id = pf.related_entity_id
      WHERE pf.is_active = true
        ${typeFilter}
        ${entityFilter}
      ORDER BY
        CASE pf.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        pf.detected_at DESC
      LIMIT ${data.limit} OFFSET ${data.offset}
    `)

    const totalRows = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::text AS count
      FROM pattern_flags pf
      WHERE pf.is_active = true
        ${typeFilter}
        ${entityFilter}
    `)

    const items: PatternFeedItem[] = Array.from(rows).map((r) => ({
      id: r.id,
      entityId: r.entity_id,
      entityName: r.entity_name,
      patternType: r.pattern_type,
      severity: r.severity,
      title: r.title,
      description: r.description,
      relatedEntityId: r.related_entity_id ?? null,
      relatedEntityName: r.related_entity_name ?? null,
      detectedAt: r.detected_at,
      detectedValue: r.detected_value ?? null,
    }))

    return {
      items,
      total: Number(Array.from(totalRows)[0]?.count ?? 0),
    }
  })
