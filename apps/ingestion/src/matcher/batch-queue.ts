import Anthropic from '@anthropic-ai/sdk'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityMatchesLog } from '@govtrace/db/schema/entities'

// Circuit breaker threshold — D-07, Pitfall 4
const CIRCUIT_BREAKER_LIMIT = 10_000
// Claude Batch API per-request limit
const MAX_BATCH_SIZE = 5_000

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export interface BatchSubmitResult {
  batchId: string
  candidatesSubmitted: number
  circuitBreakerTriggered: boolean
}

/**
 * Collects all 'uncertain' records from entity_matches_log and submits them
 * to the Claude Batch API for verification.
 *
 * CIRCUIT BREAKER: if candidates exceed CIRCUIT_BREAKER_LIMIT (10,000), this function
 * throws a CircuitBreakerError instead of submitting — prevents cost runaway (D-07, Pitfall 4).
 * Pass force=true to override the circuit breaker (use with care — estimate cost first).
 */
export async function submitMatchingBatch(force = false): Promise<BatchSubmitResult> {
  const db = getDb()

  // Fetch all uncertain match candidates
  const candidates = await db
    .select()
    .from(entityMatchesLog)
    .where(
      and(
        eq(entityMatchesLog.decision, 'uncertain'),
        eq(entityMatchesLog.isFlaggedForReview, false),
      ),
    )

  if (candidates.length === 0) {
    console.log('No uncertain candidates to process.')
    return { batchId: '', candidatesSubmitted: 0, circuitBreakerTriggered: false }
  }

  // CIRCUIT BREAKER — D-07, Pitfall 4
  if (candidates.length > CIRCUIT_BREAKER_LIMIT && !force) {
    throw new CircuitBreakerError(
      `Circuit breaker triggered: ${candidates.length} candidates exceed limit of ${CIRCUIT_BREAKER_LIMIT}.\n` +
      `Estimated cost at claude-haiku-4-5-20251001 rates (~250 tokens/request, $0.25/million input tokens):\n` +
      `  ~$${((candidates.length * 250) / 1_000_000 * 0.25).toFixed(2)} USD\n` +
      `Run with force=true to override, or process one year of Elections Canada first to calibrate costs.`,
    )
  }

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

  const client = new Anthropic({ apiKey })

  // Build batch requests — process in chunks of MAX_BATCH_SIZE
  const batch = candidates.slice(0, MAX_BATCH_SIZE)
  const requests: Anthropic.Beta.Messages.BatchCreateParams.Request[] = batch.map(candidate => ({
    custom_id: candidate.id,
    params: {
      model: HAIKU_MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user' as const,
        content: buildVerificationPrompt(candidate.rawNameA, candidate.rawNameB),
      }],
    },
  }))

  console.log(`Submitting batch of ${requests.length} candidates to Claude Batch API...`)

  const result = await client.beta.messages.batches.create({ requests })

  console.log(`Batch submitted: ${result.id} (${result.request_counts.processing} processing)`)

  // Store batch ID for later polling in process-batch-results.ts
  // Log to DB so we can resume polling after restarts
  for (const candidate of batch) {
    await db.update(entityMatchesLog)
      .set({ matchMethod: `ai_batch:${result.id}` })
      .where(eq(entityMatchesLog.id, candidate.id))
  }

  return {
    batchId: result.id,
    candidatesSubmitted: requests.length,
    circuitBreakerTriggered: false,
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

function buildVerificationPrompt(nameA: string, nameB: string): string {
  return `You are an entity resolution system for Canadian government data.

Determine whether these two names refer to the same real-world entity (person, company, or organization).

Name A: "${nameA}"
Name B: "${nameB}"

IMPORTANT GUIDELINES:
- Be conservative: if there is genuine doubt, return "uncertain"
- For individuals: same name alone is NOT sufficient evidence. Different people share names.
- For companies: if one name is clearly a short form of the other (e.g., "CGI" vs "CGI Group Inc."), return "match"
- False positive merges cause reputational harm

Respond with JSON only:
{
  "verdict": "match" | "no_match" | "uncertain",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation"
}`
}
