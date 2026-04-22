import { eq } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entities, entityAliases, entityMatchesLog } from '@govtrace/db/schema/entities'
import { normalizeName } from '../normalizer/normalize.ts'

export interface MatchResult {
  entityId: string
  matchMethod: 'deterministic' | 'fuzzy' | 'ai_verified' | 'new_entity'
  confidenceScore: number
}

/**
 * Looks for an exact normalized_name match in the entities table.
 * If found: creates an entity_alias record and logs the match.
 * If not found: returns null (caller creates a new entity).
 */
export async function findDeterministicMatch(
  rawName: string,
  sourceTable: string,
  sourceField: string,
): Promise<MatchResult | null> {
  const db = getDb()
  const normalizedName = normalizeName(rawName)
  if (!normalizedName) return null

  // Exact match on normalized_name
  // Use select() instead of db.query.* to avoid relational API type inference issues
  const results = await db.select().from(entities).where(eq(entities.normalizedName, normalizedName)).limit(1)
  const existing = results[0]

  if (!existing) return null

  // Store alias record
  await db.insert(entityAliases).values({
    entityId: existing.id,
    rawName,
    normalizedName,
    sourceTable,
    sourceField,
    matchMethod: 'deterministic',
    confidenceScore: 1.0,
    isVerified: true,
  }).onConflictDoNothing() // alias may already exist from previous run

  // Log the match decision
  await db.insert(entityMatchesLog).values({
    entityBId: existing.id,
    rawNameA: rawName,
    rawNameB: existing.canonicalName,
    normalizedNameA: normalizedName,
    normalizedNameB: existing.normalizedName,
    matchMethod: 'deterministic',
    similarityScore: 1.0,
    decision: 'match',
  })

  return {
    entityId: existing.id,
    matchMethod: 'deterministic',
    confidenceScore: 1.0,
  }
}

/**
 * Creates a new entity record for a name that had no match.
 * Infers entity type from source table and raw name heuristics.
 */
export async function createNewEntity(
  rawName: string,
  sourceTable: string,
  sourceField: string,
  entityType?: string,
): Promise<string> {
  const db = getDb()
  const normalizedName = normalizeName(rawName)

  // Defence-in-depth: refuse to create entities for rejected raw names
  // (e.g. bilingual CSV-header artifacts). normalizeName returns '' for
  // these; without this guard, upstream code paths that bypass the
  // findDeterministicMatch early-return could still call createNewEntity
  // and pollute the entities table.
  if (!normalizedName) {
    throw new Error(`Refusing to create entity for rejected raw name: ${rawName}`)
  }

  // Infer entity type from source if not provided
  const inferredType = entityType ?? inferEntityType(sourceTable, rawName)

  const [entity] = await db.insert(entities).values({
    canonicalName: rawName,
    normalizedName,
    entityType: inferredType,
  }).onConflictDoUpdate({
    target: [entities.canonicalName, entities.entityType],
    set: { normalizedName: normalizeName(rawName) ?? normalizedName ?? '' },
  }).returning()

  if (!entity) throw new Error(`Failed to create entity for: ${rawName}`)

  // Store alias record
  await db.insert(entityAliases).values({
    entityId: entity.id,
    rawName,
    normalizedName,
    sourceTable,
    sourceField,
    matchMethod: 'deterministic',
    confidenceScore: 1.0,
    isVerified: true,
  }).onConflictDoNothing()

  return entity.id
}

function inferEntityType(sourceTable: string, rawName: string): string {
  // Heuristic: donations and lobby_communications often contain both persons and companies
  // Simple heuristic: contains Inc./Ltd./Corp. → company; otherwise → person
  const companyIndicators = /\b(inc|ltd|corp|llc|group|services|solutions|association|institute)\b/i
  if (companyIndicators.test(rawName)) return 'company'

  // Department indicators
  const deptIndicators = /\b(canada|government|ministry|department|agency|office|commission)\b/i
  if (deptIndicators.test(rawName)) return 'department'

  // Default by source
  if (sourceTable === 'contracts' || sourceTable === 'grants') return 'company'
  if (sourceTable === 'lobby_registrations') return 'organization'
  return 'person' // donations default to person
}
