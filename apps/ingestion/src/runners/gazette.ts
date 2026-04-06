/**
 * Canada Gazette Part II ingestion pipeline
 *
 * Phases:
 *   A — Discover biweekly issue URLs from 2020 to current year
 *   B — For each issue URL, fetch HTML index, parse regulations, upsert to DB
 *
 * Polite scraping:
 *   - 1500ms delay between issue page requests
 *   - USER_AGENT identifies GovTrace as civic tech
 */
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { discoverIssueUrls, fetchIssueIndex } from '../downloaders/gazette.ts'
import { parseGazetteIndex } from '../parsers/gazette.ts'
import { upsertGazetteRegulations } from '../upsert/gazette.ts'

const POLITE_DELAY_MS = 1500
const LOG_EVERY_N_ISSUES = 10
const START_YEAR = 2020

/**
 * Courteous HTTP delay between page requests.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs the complete Canada Gazette Part II ingestion pipeline.
 * Phase A: Discover issue URLs for START_YEAR to current year.
 * Phase B: For each issue URL, fetch HTML index, parse, and upsert.
 */
export async function runGazetteIngestion(): Promise<void> {
  const db = getDb()
  const endYear = new Date().getFullYear()

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'gazette',
      status: 'running',
      sourceFileUrl: `https://gazette.gc.ca/rp-pr/p2/${endYear}/`,
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id

  const stats = {
    issuesDiscovered: 0,
    issuesProcessed: 0,
    issuesSkipped: 0,
    regulationsUpserted: 0,
  }

  try {
    // =========================================================
    // Phase A: Discover issue URLs
    // =========================================================
    console.log(`\n=== Phase A: Discovering Canada Gazette Part II issues (${START_YEAR}–${endYear}) ===`)
    const issueUrls = await discoverIssueUrls(START_YEAR, endYear)
    stats.issuesDiscovered = issueUrls.length
    console.log(`  Found ${issueUrls.length} Part II issues`)

    // =========================================================
    // Phase B: Fetch each issue index, parse, and upsert
    // =========================================================
    console.log('\n=== Phase B: Parsing and upserting regulations ===')

    for (let i = 0; i < issueUrls.length; i++) {
      const issueUrl = issueUrls[i]
      if (!issueUrl) continue

      try {
        const html = await fetchIssueIndex(issueUrl)
        const regulations = parseGazetteIndex(html, issueUrl)

        if (regulations.length > 0) {
          const result = await upsertGazetteRegulations(regulations)
          stats.regulationsUpserted += result.inserted
        }

        stats.issuesProcessed++

        if ((i + 1) % LOG_EVERY_N_ISSUES === 0) {
          console.log(
            `  Progress: ${i + 1}/${issueUrls.length} issues | ${stats.regulationsUpserted} regulations upserted`,
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Skipping issue ${issueUrl}: ${msg}`)
        stats.issuesSkipped++
      }

      // Polite 1.5s delay between issue page requests
      if (i < issueUrls.length - 1) {
        await sleep(POLITE_DELAY_MS)
      }
    }

    console.log(
      `Phase B complete: ${stats.regulationsUpserted} regulations from ${stats.issuesProcessed} issues (${stats.issuesSkipped} skipped)`,
    )

    // =========================================================
    // Log ingestion run result
    // =========================================================
    await db
      .update(ingestionRuns)
      .set({
        status: 'completed',
        recordsProcessed: stats.issuesProcessed,
        recordsInserted: stats.regulationsUpserted,
        completedAt: new Date(),
        auditData: stats as unknown as Record<string, unknown>,
      })
      .where(sql`id = ${runId}`)

    console.log('\n=== Canada Gazette ingestion complete ===')
    console.log(`  Issues discovered: ${stats.issuesDiscovered}`)
    console.log(`  Issues processed: ${stats.issuesProcessed} (${stats.issuesSkipped} skipped)`)
    console.log(`  Regulations upserted: ${stats.regulationsUpserted}`)
  } catch (error) {
    await db
      .update(ingestionRuns)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(sql`id = ${runId}`)
    throw error
  }
}
