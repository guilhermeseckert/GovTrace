import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, count, desc, eq, or, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@govtrace/db/client'
import { aiSummaries, entities } from '@govtrace/db/schema/entities'
import { contracts, donations, grants, lobbyRegistrations } from '@govtrace/db/schema/raw'
import { entityConnections } from '@govtrace/db/schema/connections'
import { parliamentVoteBallots, parliamentVotes } from '@govtrace/db/schema/parliament'
import { formatAmount } from '@/lib/connection-labels'

// Current model as of March 2026 — claude-haiku-4-5, NOT haiku-3-5
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001'

// Version marker appended to model field — old summaries without this are treated as stale
// v3: adds voting pattern insights for politicians (PARL-04)
const PROMPT_VERSION = '-v3'

const SummaryInputSchema = z.object({ entityId: z.string().uuid() })

type TopConnection = {
  connectedEntityName: string
  connectionType: string
  totalValue: string | null
  transactionCount: number
}

/** Query top connections by value, searching both directions of the entity_connections table. */
async function getTopConnections(
  db: ReturnType<typeof getDb>,
  entityId: string,
  limit = 20,
): Promise<TopConnection[]> {
  const entitiesAlias = entities

  // Direction A: entity is entityAId, connected entity is entityBId
  const rowsA = await db
    .select({
      connectedEntityName: entitiesAlias.canonicalName,
      connectionType: entityConnections.connectionType,
      totalValue: entityConnections.totalValue,
      transactionCount: entityConnections.transactionCount,
    })
    .from(entityConnections)
    .innerJoin(entitiesAlias, eq(entitiesAlias.id, entityConnections.entityBId))
    .where(eq(entityConnections.entityAId, entityId))

  // Direction B: entity is entityBId, connected entity is entityAId
  const rowsB = await db
    .select({
      connectedEntityName: entitiesAlias.canonicalName,
      connectionType: entityConnections.connectionType,
      totalValue: entityConnections.totalValue,
      transactionCount: entityConnections.transactionCount,
    })
    .from(entityConnections)
    .innerJoin(entitiesAlias, eq(entitiesAlias.id, entityConnections.entityAId))
    .where(eq(entityConnections.entityBId, entityId))

  // Merge, sort by totalValue desc, take top N
  const merged = [...rowsA, ...rowsB].sort((a, b) => {
    const valA = Number(a.totalValue ?? 0)
    const valB = Number(b.totalValue ?? 0)
    return valB - valA
  })

  return merged.slice(0, limit)
}

function buildSummaryPrompt(params: {
  name: string
  entityType: string
  donationCount: number
  contractCount: number
  grantCount: number
  lobbyCount: number
  connections: TopConnection[]
  voteCount?: number
  topYeaSubjects?: string[]
  topDonors?: string[]
}): string {
  const connectionLines = params.connections
    .map((c) => {
      const typeLabel = c.connectionType.replaceAll('_', ' ')
      const value = formatAmount(c.totalValue)
      return `- ${c.connectedEntityName} (${typeLabel}): ${value}, ${c.transactionCount} transactions`
    })
    .join('\n')

  const connectionsSection =
    params.connections.length > 0
      ? `\nKnown connections (top by value):\n${connectionLines}\n`
      : ''

  // PARL-04: Add voting pattern section for politicians with votes
  let votingSection = ''
  if (params.entityType === 'politician' && params.voteCount && params.voteCount > 0) {
    const yeaList = params.topYeaSubjects && params.topYeaSubjects.length > 0
      ? params.topYeaSubjects.join('; ')
      : 'various bills and motions'
    const donorList = params.topDonors && params.topDonors.length > 0
      ? params.topDonors.join(', ')
      : 'unknown donors'

    votingSection = `\nVoting record: This politician voted in ${params.voteCount} recorded divisions. Their most common Yea votes were on bills related to: ${yeaList}. They received donations from: ${donorList}.\n`
  }

  return `You are writing a plain-language summary for GovTrace, a Canadian civic transparency platform.

Write a 2-3 sentence summary about "${params.name}" (a ${params.entityType}) based on these government records:
- ${params.donationCount} political donation records
- ${params.contractCount} federal contract records
- ${params.grantCount} federal grant records
- ${params.lobbyCount} lobbying activity records
${connectionsSection}${votingSection}
Rules:
- Write in plain language a 9-year-old could follow
- Use rounded numbers (e.g., "about 50" not "47")
- Name specific people and companies from the connections data
- Connect dots across datasets (e.g., "donated to X and also received contracts from Y")
- For politicians with votes, mention notable voting patterns if they connect with donor data (e.g., "Voted in favour of energy bills — received donations from oil companies")
- Use dollar amounts when available
- ALWAYS include this exact phrase at the end: "Connections shown do not imply wrongdoing."
- Do NOT speculate about intent or imply wrongdoing
- Maximum 80 words

Summary:`
}

// Cache-first pattern: check ai_summaries for fresh entry -> return immediately.
// On cache miss: generate via claude-haiku-4-5 -> save to cache (AI-01, AI-02, AI-03).
// Per Pitfall 5: do NOT await generation in the profile page loader — let the component
// trigger it client-side if missing. (PROF-02)
export const getOrGenerateSummary = createServerFn({ method: 'GET' })
  .inputValidator(SummaryInputSchema)
  .handler(async ({ data }): Promise<string | null> => {
    const db = getDb()

    // Cache-first check (AI-03) with version marker — old summaries regenerate
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

    if (cached.length > 0 && cached[0]) {
      // Version check: if model field doesn't end with PROMPT_VERSION, treat as stale
      if (cached[0].model.endsWith(PROMPT_VERSION)) {
        return cached[0].summaryText
      }
    }

    // Fetch entity info first
    const entityRows = await db.select().from(entities).where(eq(entities.id, data.entityId)).limit(1)
    if (entityRows.length === 0) return null
    const entity = entityRows[0]
    if (!entity) return null

    // Politicians receive donations (by name), others make them (by entity_id)
    const isPolitician = entity.entityType === 'politician'
    const donWhere = isPolitician
      ? eq(donations.recipientName, entity.canonicalName)
      : eq(donations.entityId, data.entityId)

    const [donCount, conCount, grCount, lobCount, connections, voteCount] = await Promise.all([
      db.select({ c: count() }).from(donations).where(donWhere),
      db.select({ c: count() }).from(contracts).where(eq(contracts.entityId, data.entityId)),
      db.select({ c: count() }).from(grants).where(eq(grants.entityId, data.entityId)),
      db.select({ c: count() }).from(lobbyRegistrations).where(
        or(eq(lobbyRegistrations.lobbyistEntityId, data.entityId), eq(lobbyRegistrations.clientEntityId, data.entityId))
      ),
      getTopConnections(db, data.entityId),
      db.select({ c: count() }).from(parliamentVoteBallots).where(eq(parliamentVoteBallots.entityId, data.entityId)),
    ])

    const totalVotes = Number(voteCount[0]?.c ?? 0)

    // PARL-04: For politicians with votes, fetch top Yea bill subjects and top donor names
    let topYeaSubjects: string[] = []
    let topDonors: string[] = []

    if (isPolitician && totalVotes > 0) {
      const [yeaSubjectRows, donorRows] = await Promise.all([
        // Top 5 subjects this politician voted Yea on (by count)
        db
          .select({
            subject: parliamentVotes.subject,
            yeaCount: count(),
          })
          .from(parliamentVoteBallots)
          .innerJoin(parliamentVotes, eq(parliamentVoteBallots.voteId, parliamentVotes.id))
          .where(
            and(
              eq(parliamentVoteBallots.entityId, data.entityId),
              eq(parliamentVoteBallots.isYea, true),
            ),
          )
          .groupBy(parliamentVotes.subject)
          .orderBy(desc(count()))
          .limit(5),

        // Top donor entity names from entity_connections (donation_to_politician type)
        db
          .select({ connectedEntityName: entities.canonicalName })
          .from(entityConnections)
          .innerJoin(entities, eq(entities.id, entityConnections.entityAId))
          .where(
            and(
              eq(entityConnections.entityBId, data.entityId),
              sql`${entityConnections.connectionType} LIKE '%donation%'`,
            ),
          )
          .orderBy(desc(entityConnections.totalValue))
          .limit(5),
      ])

      topYeaSubjects = yeaSubjectRows.map((r) => r.subject)
      topDonors = donorRows.map((r) => r.connectedEntityName)
    }

    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: buildSummaryPrompt({
          name: entity.canonicalName,
          entityType: entity.entityType,
          donationCount: Number(donCount[0]?.c ?? 0),
          contractCount: Number(conCount[0]?.c ?? 0),
          grantCount: Number(grCount[0]?.c ?? 0),
          lobbyCount: Number(lobCount[0]?.c ?? 0),
          connections,
          voteCount: totalVotes,
          topYeaSubjects,
          topDonors,
        }),
      }],
    })

    const summaryText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!summaryText) return null

    // Cache the result — upsert on entityId unique constraint (AI-03)
    // Append PROMPT_VERSION to model field for future version checks.
    //
    // Note: facts_block column added to ai_summaries by migration 0011 is
    // intentionally NOT populated here. FactBlock renders client-side from
    // aggregates passed as props in AISummary; persisting facts_block would
    // require pulling computeAggregates (and its drizzle/postgres transitive
    // graph) into the summary server-fn, which bleeds into the client bundle
    // because AISummary imports getOrGenerateSummary. The column is reserved
    // for a follow-up that persists facts via a dedicated server-fn.
    await db.insert(aiSummaries).values({
      entityId: data.entityId,
      summaryText,
      model: SUMMARY_MODEL + PROMPT_VERSION,
      isStale: false,
    }).onConflictDoUpdate({
      target: aiSummaries.entityId,
      set: {
        summaryText,
        model: SUMMARY_MODEL + PROMPT_VERSION,
        isStale: false,
        generatedAt: new Date(),
      },
    })

    return summaryText
  })
