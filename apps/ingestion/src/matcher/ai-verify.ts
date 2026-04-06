import Anthropic from '@anthropic-ai/sdk'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const SONNET_MODEL = 'claude-sonnet-4-5-20250514'

export type AIVerdict = 'match' | 'no_match' | 'uncertain'

export interface AIVerificationResult {
  verdict: AIVerdict
  confidence: number    // 0.0–1.0
  reasoning: string
  model: string
}

/**
 * Asks Claude to verify whether two entity names refer to the same real-world entity.
 * Used for single records during testing and small-batch processing.
 * For large batches, use submitMatchingBatch() which uses the Batch API.
 *
 * Model selection per STACK.md:
 * - claude-haiku-4-5-20251001: high volume medium-confidence matches (cost-sensitive)
 * - claude-sonnet-4-5-20250514: ambiguous cases where haiku returns 'uncertain'
 */
export async function verifyMatchWithAI(
  nameA: string,
  nameB: string,
  contextA?: string,  // e.g., "Elections Canada donor from Ontario, $500 donation 2018"
  contextB?: string,
): Promise<AIVerificationResult> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

  const client = new Anthropic({ apiKey })

  const contextNote = contextA ?? contextB
    ? `\nContext: Name A appears in "${contextA ?? 'unknown source'}". Name B appears in "${contextB ?? 'unknown source'}".`
    : ''

  const prompt = `You are an entity resolution system for Canadian government data.

Determine whether these two names refer to the same real-world entity (person, company, or organization).

Name A: "${nameA}"
Name B: "${nameB}"${contextNote}

IMPORTANT GUIDELINES:
- Be conservative: if there is genuine doubt, return "uncertain"
- For individuals: same name alone is NOT sufficient evidence. Different people share names.
- For companies: if one name is clearly a short form of the other (e.g., "CGI" vs "CGI Group Inc."), return "match"
- "Connections do not imply wrongdoing" — false positive merges cause reputational harm

Respond with JSON only:
{
  "verdict": "match" | "no_match" | "uncertain",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation"
}`

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error(`Unexpected response type from Claude: ${content.type}`)
  }

  try {
    // Extract JSON from response (Claude may include explanation text)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in Claude response')

    const parsed = JSON.parse(jsonMatch[0]) as {
      verdict: AIVerdict
      confidence: number
      reasoning: string
    }

    return {
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      model: HAIKU_MODEL,
    }
  } catch {
    throw new Error(`Failed to parse Claude response: ${content.text}`)
  }
}

// Export SONNET_MODEL for use by callers who need escalation to a stronger model
export { SONNET_MODEL }
