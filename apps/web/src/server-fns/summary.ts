import { createServerFn } from '@tanstack/react-start'
import { ensureEnv } from './env'
import { z } from 'zod'
import { and, count, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@govtrace/db/client'
import { aiSummaries, entities } from '@govtrace/db/schema/entities'
import { contracts, donations, grants } from '@govtrace/db/schema/raw'

// Current model as of March 2026 — claude-haiku-4-5, NOT haiku-3-5
const SUMMARY_MODEL = 'claude-haiku-4-5-20241022'

const SummaryInputSchema = z.object({ entityId: z.string().uuid() })

function buildSummaryPrompt(params: {
  name: string
  entityType: string
  donationCount: number
  contractCount: number
  grantCount: number
  lobbyCount: number
}): string {
  return `You are writing a plain-language summary for GovTrace, a Canadian civic transparency platform.

Write a 2-3 sentence summary about "${params.name}" (a ${params.entityType}) based on these government records:
- 💰 ${params.donationCount} political donation records
- 📄 ${params.contractCount} federal contract records
- 💵 ${params.grantCount} federal grant records
- 🤝 ${params.lobbyCount} lobbying activity records

Rules:
- Use simple words a 9-year-old could understand
- Use rounded numbers (e.g., "about 50" not "47")
- Use the emoji icons shown above when referring to each dataset
- ALWAYS include this exact phrase at the end: "Connections shown do not imply wrongdoing."
- Do NOT speculate about intent or imply wrongdoing
- Maximum 60 words

Summary:`
}

// Cache-first pattern: check ai_summaries for fresh entry → return immediately.
// On cache miss: generate via claude-haiku-4-5 → save to cache (AI-01, AI-02, AI-03).
// Per Pitfall 5: do NOT await generation in the profile page loader — let the component
// trigger it client-side if missing. (PROF-02)
export const getOrGenerateSummary = createServerFn({ method: 'GET' })
  .inputValidator(SummaryInputSchema)
  .handler(async ({ data }): Promise<string | null> => {
    await ensureEnv()
    const db = getDb()

    // Cache-first check (AI-03)
    const cached = await db
      .select()
      .from(aiSummaries)
      .where(
        and(
          eq(aiSummaries.entityId, data.entityId),
          eq(aiSummaries.isStale, false),
        )
      )
      .limit(1)

    if (cached.length > 0 && cached[0]) return cached[0].summaryText

    // Fetch entity info first
    const entityRows = await db.select().from(entities).where(eq(entities.id, data.entityId)).limit(1)
    if (entityRows.length === 0) return null
    const entity = entityRows[0]

    // Politicians receive donations (by name), others make them (by entity_id)
    const isPolitician = entity.entityType === 'politician'
    const donWhere = isPolitician
      ? eq(donations.recipientName, entity.canonicalName)
      : eq(donations.entityId, data.entityId)

    const [donCount, conCount, grCount] = await Promise.all([
      db.select({ c: count() }).from(donations).where(donWhere),
      db.select({ c: count() }).from(contracts).where(eq(contracts.entityId, data.entityId)),
      db.select({ c: count() }).from(grants).where(eq(grants.entityId, data.entityId)),
    ])

    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: buildSummaryPrompt({
          name: entity.canonicalName,
          entityType: entity.entityType,
          donationCount: Number(donCount[0]?.c ?? 0),
          contractCount: Number(conCount[0]?.c ?? 0),
          grantCount: Number(grCount[0]?.c ?? 0),
          lobbyCount: 0,
        }),
      }],
    })

    const summaryText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!summaryText) return null

    // Cache the result — upsert on entityId unique constraint (AI-03)
    await db.insert(aiSummaries).values({
      entityId: data.entityId,
      summaryText,
      model: SUMMARY_MODEL,
      isStale: false,
    }).onConflictDoUpdate({
      target: aiSummaries.entityId,
      set: {
        summaryText,
        model: SUMMARY_MODEL,
        isStale: false,
        generatedAt: new Date(),
      },
    })

    return summaryText
  })
