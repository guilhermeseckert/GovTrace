/**
 * Pattern detection runner
 *
 * Detects suspicious patterns across datasets:
 *   1. Donation spikes near contract awards (90-day window)
 *   2. Lobbying communication clusters before contracts
 *   3. Outlier contributions (top 1% / 0.1%)
 *   4. Donations before GIC appointments
 *
 * Writes results to pattern_flags table. Idempotent — duplicate inserts
 * are silently skipped via try/catch on unique constraint violations.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { patternFlags } from '@govtrace/db/schema/entities'

const TEMPORAL_WINDOW_DAYS = 90
const DONATION_SPIKE_MULTIPLIER = 2
const DONATION_HIGH_SEVERITY_MULTIPLIER = 5
const LOBBYING_CLUSTER_MEDIUM_THRESHOLD = 3
const LOBBYING_CLUSTER_HIGH_THRESHOLD = 5
const DONATION_HIGH_SEVERITY_AMOUNT = 1000
const APPOINTMENT_SHORT_WINDOW_DAYS = 90
const CAUSATION_CAVEAT =
  'Temporal proximity does not imply a causal relationship. This pattern is flagged for transparency.'

type DbInstance = ReturnType<typeof getDb>

function formatCad(value: string | number): string {
  const n = Number(value)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

async function detectDonationSpikes(db: DbInstance): Promise<number> {
  const rows = await db.execute<{
    entity_id: string; donation_id: string; contract_id: string
    donation_amount: string; avg_donation: string; donation_date: string
    award_date: string; days_apart: string
  }>(sql`
    SELECT d.entity_id, d.id AS donation_id, c.id AS contract_id,
      d.amount::text AS donation_amount, avg_d.avg_amount::text AS avg_donation,
      d.donation_date::text AS donation_date, c.award_date::text AS award_date,
      ABS(c.award_date - d.donation_date)::text AS days_apart
    FROM donations d
    JOIN contracts c ON c.entity_id = d.entity_id
    JOIN (SELECT entity_id, AVG(amount) AS avg_amount FROM donations WHERE entity_id IS NOT NULL GROUP BY entity_id) avg_d ON avg_d.entity_id = d.entity_id
    WHERE d.entity_id IS NOT NULL AND c.entity_id IS NOT NULL
      AND ABS(c.award_date - d.donation_date) <= 90
      AND d.amount > avg_d.avg_amount * 2
    ORDER BY d.amount DESC LIMIT 500
  `)
  let count = 0
  for (const row of Array.from(rows)) {
    const donationAmt = Number(row.donation_amount)
    const avgAmt = Number(row.avg_donation)
    const severity = donationAmt > avgAmt * DONATION_HIGH_SEVERITY_MULTIPLIER ? 'high' : 'medium'
    const daysPart = Number(row.days_apart)
    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id, patternType: 'donation_spike_near_contract', severity,
        title: `Donated ${formatCad(donationAmt)} within ${String(daysPart)} days of contract award`,
        description: `A donation of ${formatCad(donationAmt)} (made on ${row.donation_date}) occurred within ${String(daysPart)} days of a government contract award (awarded on ${row.award_date}). The entity's average donation is ${formatCad(row.avg_donation)}. ${CAUSATION_CAVEAT}`,
        evidenceRecordIds: [row.donation_id, row.contract_id], evidenceTables: ['donations', 'contracts'],
        timeWindowStart: row.donation_date < row.award_date ? row.donation_date : row.award_date,
        timeWindowEnd: row.donation_date > row.award_date ? row.donation_date : row.award_date,
        detectedValue: row.donation_amount,
      })
      count++
    } catch { /* skip duplicates */ }
  }
  return count
}

async function detectLobbyingClusters(db: DbInstance): Promise<number> {
  const rows = await db.execute<{
    entity_id: string; communication_ids: string; communication_count: string
    award_date: string; window_start: string; contract_id: string; contract_value: string
  }>(sql`
    SELECT lr.client_entity_id AS entity_id,
      STRING_AGG(lc.id, ',' ORDER BY lc.communication_date) AS communication_ids,
      COUNT(lc.id)::text AS communication_count,
      c.award_date::text AS award_date, (c.award_date - INTERVAL '90 days')::text AS window_start,
      c.id AS contract_id, c.value::text AS contract_value
    FROM lobby_registrations lr
    JOIN lobby_communications lc ON lc.registration_number = lr.registration_number
    JOIN contracts c ON c.entity_id = lr.client_entity_id
    WHERE lr.client_entity_id IS NOT NULL AND c.award_date IS NOT NULL
      AND lc.communication_date BETWEEN c.award_date - INTERVAL '90 days' AND c.award_date
    GROUP BY lr.client_entity_id, c.id, c.award_date, c.value
    HAVING COUNT(lc.id) >= 3
    ORDER BY COUNT(lc.id) DESC LIMIT 300
  `)
  let count = 0
  for (const row of Array.from(rows)) {
    const commCount = Number(row.communication_count)
    const severity = commCount >= LOBBYING_CLUSTER_HIGH_THRESHOLD ? 'high' : 'medium'
    const contractValStr = row.contract_value ? ` (value: ${formatCad(row.contract_value)})` : ''
    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id, patternType: 'lobbying_cluster_before_contract', severity,
        title: `${String(commCount)} lobbying communications in ${String(TEMPORAL_WINDOW_DAYS)} days before contract award`,
        description: `${String(commCount)} registered lobby communications were filed between ${row.window_start} and ${row.award_date}, the 90-day window preceding a contract award${contractValStr}. ${CAUSATION_CAVEAT}`,
        evidenceRecordIds: [...row.communication_ids.split(','), row.contract_id],
        evidenceTables: ['lobby_communications', 'contracts'],
        timeWindowStart: row.window_start, timeWindowEnd: row.award_date,
      })
      count++
    } catch { /* skip duplicates */ }
  }
  return count
}

async function detectOutlierContributions(db: DbInstance): Promise<number> {
  const rows = await db.execute<{
    donation_id: string; entity_id: string; amount: string; contributor_type: string
    p99: string; p999: string; donation_date: string; recipient_name: string
  }>(sql`
    WITH percentiles AS (
      SELECT contributor_type,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY amount::numeric) AS p99,
        PERCENTILE_CONT(0.999) WITHIN GROUP (ORDER BY amount::numeric) AS p999
      FROM donations WHERE entity_id IS NOT NULL AND contributor_type IS NOT NULL
      GROUP BY contributor_type
    )
    SELECT d.id AS donation_id, d.entity_id, d.amount::text AS amount, d.contributor_type,
      p.p99::text AS p99, p.p999::text AS p999, d.donation_date::text AS donation_date, d.recipient_name
    FROM donations d JOIN percentiles p ON p.contributor_type = d.contributor_type
    WHERE d.entity_id IS NOT NULL AND d.amount::numeric > p.p99
    ORDER BY d.amount::numeric DESC LIMIT 300
  `)
  let count = 0
  for (const row of Array.from(rows)) {
    const amt = Number(row.amount)
    const p999 = Number(row.p999)
    const severity = amt > p999 ? 'high' : 'medium'
    const threshold = severity === 'high' ? 'top 0.1%' : 'top 1%'
    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id, patternType: 'outlier_contribution', severity,
        title: `${formatCad(amt)} donation places this entity in the ${threshold} of ${row.contributor_type ?? 'contributor'} donors`,
        description: `A donation of ${formatCad(amt)} was made on ${row.donation_date} to ${row.recipient_name}. This amount is in the ${threshold} of all donations by ${row.contributor_type ?? 'this contributor type'}. The 99th percentile threshold is ${formatCad(row.p99)}. ${CAUSATION_CAVEAT}`,
        evidenceRecordIds: [row.donation_id], evidenceTables: ['donations'],
        timeWindowStart: row.donation_date, timeWindowEnd: row.donation_date,
        detectedValue: row.amount,
      })
      count++
    } catch { /* skip duplicates */ }
  }
  return count
}

async function detectDonationBeforeAppointment(db: DbInstance): Promise<number> {
  const rows = await db.execute<{
    entity_id: string; donation_id: string; appointment_id: string
    donation_amount: string; donation_date: string; recipient_name: string
    appointment_date: string; organization_name: string; position_title: string; days_before: string
  }>(sql`
    SELECT d.entity_id, d.id AS donation_id, ga.id AS appointment_id,
      d.amount::text AS donation_amount, d.donation_date::text AS donation_date, d.recipient_name,
      ga.appointment_date::text AS appointment_date, ga.organization_name, ga.position_title,
      (ga.appointment_date - d.donation_date)::text AS days_before
    FROM donations d JOIN gic_appointments ga ON ga.entity_id = d.entity_id
    WHERE d.entity_id IS NOT NULL AND d.donation_date < ga.appointment_date
      AND (ga.appointment_date - d.donation_date) <= 365 AND ga.is_vacant = false
    ORDER BY d.amount::numeric DESC LIMIT 500
  `)
  let count = 0
  for (const row of Array.from(rows)) {
    const amount = Number(row.donation_amount)
    const daysBefore = Number(row.days_before)
    const severity = amount > DONATION_HIGH_SEVERITY_AMOUNT && daysBefore <= APPOINTMENT_SHORT_WINDOW_DAYS ? 'high' : 'medium'
    try {
      await db.insert(patternFlags).values({
        entityId: row.entity_id, patternType: 'donation_before_appointment', severity,
        title: `Donated ${formatCad(amount)} to ${row.recipient_name} ${String(daysBefore)} days before appointment to ${row.organization_name}`,
        description: `A donation of ${formatCad(amount)} was made to ${row.recipient_name} on ${row.donation_date}, ${String(daysBefore)} days before an appointment to ${row.organization_name} as ${row.position_title} on ${row.appointment_date}. ${CAUSATION_CAVEAT}`,
        evidenceRecordIds: [row.donation_id, row.appointment_id],
        evidenceTables: ['donations', 'gic_appointments'],
        timeWindowStart: row.donation_date, timeWindowEnd: row.appointment_date,
        detectedValue: row.donation_amount,
      })
      count++
    } catch { /* skip duplicates */ }
  }
  return count
}

export async function runPatternDetection(): Promise<void> {
  const db = getDb()

  console.log('Running pattern detection...')

  console.log('  Detecting donation spikes near contracts...')
  const spikes = await detectDonationSpikes(db)
  console.log(`  Found ${spikes} donation spike patterns`)

  console.log('  Detecting lobbying clusters before contracts...')
  const clusters = await detectLobbyingClusters(db)
  console.log(`  Found ${clusters} lobbying cluster patterns`)

  console.log('  Detecting outlier contributions...')
  const outliers = await detectOutlierContributions(db)
  console.log(`  Found ${outliers} outlier contribution patterns`)

  console.log('  Detecting donations before appointments...')
  const appointments = await detectDonationBeforeAppointment(db)
  console.log(`  Found ${appointments} donation-before-appointment patterns`)

  const total = spikes + clusters + outliers + appointments
  console.log(`Pattern detection complete: ${total} new patterns flagged`)
}
