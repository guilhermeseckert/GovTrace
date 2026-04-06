import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityAliases, entityMatchesLog } from '@govtrace/db/schema/entities'
import { normalizeName } from '../normalizer/normalize.ts'
import type { AIVerdict } from './ai-verify.ts'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export interface BatchProcessResult {
  batchId: string
  processed: number
  matched: number
  noMatch: number
  uncertain: number
  errors: number
}

/**
 * Polls a Claude Batch API job until complete, then processes all results.
 * Updates entity_matches_log with AI verdict, confidence, and reasoning.
 * For 'match' verdicts: creates entity_alias and updates source record entity_id.
 *
 * @param batchId - The batch ID returned by submitMatchingBatch()
 * @param pollIntervalMs - How often to check batch status (default: 60 seconds)
 */
export async function processBatchResults(
  batchId: string,
  pollIntervalMs = 60_000,
): Promise<BatchProcessResult> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

  const client = new Anthropic({ apiKey })
  const db = getDb()

  const result: BatchProcessResult = {
    batchId,
    processed: 0,
    matched: 0,
    noMatch: 0,
    uncertain: 0,
    errors: 0,
  }

  // Poll until complete
  console.log(`Polling batch ${batchId}...`)
  let status = 'in_progress'
  while (status === 'in_progress') {
    const batch = await client.beta.messages.batches.retrieve(batchId)
    status = batch.processing_status

    if (status === 'in_progress') {
      const { processing, succeeded, errored } = batch.request_counts
      console.log(`  Status: ${succeeded} done, ${processing} processing, ${errored} errors`)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
  }

  if (status !== 'ended') {
    throw new Error(`Batch ${batchId} ended with unexpected status: ${status}`)
  }

  console.log(`Batch ${batchId} complete. Processing results...`)

  // Stream results and process each
  for await (const item of await client.beta.messages.batches.results(batchId)) {
    result.processed++
    const matchLogId = item.custom_id

    if (item.result.type === 'error') {
      result.errors++
      await db.update(entityMatchesLog)
        .set({ matchMethod: 'ai_batch', decision: 'uncertain', resolvedAt: new Date() })
        .where(eq(entityMatchesLog.id, matchLogId))
      continue
    }

    const content = item.result.message.content[0]
    if (content.type !== 'text') continue

    let verdict: AIVerdict = 'uncertain'
    let confidence = 0
    let reasoning = ''

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          verdict: AIVerdict
          confidence: number
          reasoning: string
        }
        verdict = parsed.verdict
        confidence = parsed.confidence
        reasoning = parsed.reasoning
      }
    } catch {
      result.errors++
    }

    // Update the match log record with AI decision — MATCH-04
    await db.update(entityMatchesLog)
      .set({
        matchMethod: 'ai_batch',
        aiModel: HAIKU_MODEL,
        aiConfidence: confidence,
        aiReasoning: reasoning,
        decision: verdict,
        resolvedAt: new Date(),
      })
      .where(eq(entityMatchesLog.id, matchLogId))

    if (verdict === 'match') {
      result.matched++
      // Fetch the match log to get entity IDs and names
      const matchLog = await db.query.entityMatchesLog.findFirst({
        where: eq(entityMatchesLog.id, matchLogId),
      })

      if (matchLog?.entityBId) {
        const normalizedNameA = normalizeName(matchLog.rawNameA)

        // Create entity alias for the matched name — MATCH-03
        await db.insert(entityAliases).values({
          entityId: matchLog.entityBId,
          rawName: matchLog.rawNameA,
          normalizedName: normalizedNameA,
          sourceTable: 'ai_batch_verification',
          sourceField: 'entity_matches_log',
          matchMethod: 'ai_batch',
          confidenceScore: confidence,
          aiReasoning: reasoning,
          isVerified: true,
        }).onConflictDoNothing()
      }
    } else if (verdict === 'no_match') {
      result.noMatch++
    } else {
      result.uncertain++
    }
  }

  console.log(`Batch processed: ${result.matched} matched, ${result.noMatch} no_match, ${result.uncertain} uncertain, ${result.errors} errors`)

  return result
}
