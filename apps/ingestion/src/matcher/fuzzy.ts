import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityAliases, entityMatchesLog } from '@govtrace/db/schema/entities'
import { normalizeName } from '../normalizer/normalize.ts'

const CERTAIN_THRESHOLD = 0.85
const FUZZY_MIN = 0.60

export interface FuzzyCandidate {
  entityId: string
  entityName: string
  similarityScore: number
  isHighConfidence: boolean // true if score >= CERTAIN_THRESHOLD
}

/**
 * Queries the entities table using pg_trgm similarity() for fuzzy matches.
 * Returns candidates above FUZZY_MIN threshold.
 * Candidates above CERTAIN_THRESHOLD are HIGH confidence (store immediately).
 * Candidates in [FUZZY_MIN, CERTAIN_THRESHOLD) are MEDIUM confidence (send to AI in Plan 07).
 *
 * Uses the GIN index on normalized_name — INFRA-07.
 */
export async function findFuzzyMatches(
  rawName: string,
): Promise<FuzzyCandidate[]> {
  const db = getDb()
  const normalizedName = normalizeName(rawName)
  if (!normalizedName) return []

  // Set pg_trgm threshold so the % operator uses the GIN index — MATCH-02
  await db.execute(sql`SET pg_trgm.similarity_threshold = ${FUZZY_MIN}`)

  // pg_trgm % operator leverages GIN index for fast pre-filtering
  const results = await db.execute<{
    id: string
    canonical_name: string
    normalized_name: string
    similarity: number
  }>(sql`
    SELECT
      id,
      canonical_name,
      normalized_name,
      similarity(normalized_name, ${normalizedName}) AS similarity
    FROM entities
    WHERE normalized_name % ${normalizedName}
    ORDER BY similarity DESC
    LIMIT 5
  `)

  // drizzle-orm with postgres-js driver returns the array directly (postgres.RowList is T[])
  return (results as unknown as Array<{ id: string; canonical_name: string; normalized_name: string; similarity: number }>).map(row => ({
    entityId: row.id,
    entityName: row.canonical_name,
    similarityScore: row.similarity,
    isHighConfidence: row.similarity >= CERTAIN_THRESHOLD,
  }))
}

/**
 * Stores a HIGH-confidence fuzzy match (similarity >= 0.85) without AI verification.
 * Logs to entity_matches_log with method 'fuzzy'.
 */
export async function storeHighConfidenceMatch(
  rawName: string,
  candidate: FuzzyCandidate,
  sourceTable: string,
  sourceField: string,
): Promise<void> {
  const db = getDb()
  const normalizedName = normalizeName(rawName)

  await db.insert(entityAliases).values({
    entityId: candidate.entityId,
    rawName,
    normalizedName,
    sourceTable,
    sourceField,
    matchMethod: 'fuzzy',
    confidenceScore: candidate.similarityScore,
    isVerified: true,
  }).onConflictDoNothing()

  await db.insert(entityMatchesLog).values({
    entityBId: candidate.entityId,
    rawNameA: rawName,
    rawNameB: candidate.entityName,
    normalizedNameA: normalizedName,
    normalizedNameB: normalizeName(candidate.entityName),
    matchMethod: 'fuzzy',
    similarityScore: candidate.similarityScore,
    decision: 'match',
  })
}
