import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as rawSchema from './schema/raw.ts'
import * as entitiesSchema from './schema/entities.ts'
import * as connectionsSchema from './schema/connections.ts'
import * as jobsSchema from './schema/jobs.ts'

export const schema = {
  ...rawSchema,
  ...entitiesSchema,
  ...connectionsSchema,
  ...jobsSchema,
}

// Lazy singleton — never instantiate at module load time (anti-pattern 2 from ARCHITECTURE.md)
// Both packages/ingestion and packages/web call this function; each gets the same singleton
let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (_db !== null) return _db
  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL environment variable is required')
  const client = postgres(url)
  _db = drizzle(client, { schema })
  return _db
}

export type Db = ReturnType<typeof getDb>
export type Schema = typeof schema
