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

// Use globalThis to persist the singleton across Vite module reloads in dev.
// Without this, every HMR triggers a new postgres connection, exhausting the pool.
const globalDb = globalThis as unknown as {
  __govtrace_db?: ReturnType<typeof drizzle>
  __govtrace_sql?: ReturnType<typeof postgres>
}

export function getDb() {
  if (globalDb.__govtrace_db) return globalDb.__govtrace_db

  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL environment variable is required')

  const client = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  })
  globalDb.__govtrace_sql = client
  globalDb.__govtrace_db = drizzle(client, { schema })

  // Warm up the connection pool — first query pays TCP handshake cost
  client`SELECT 1`.catch(() => {})

  return globalDb.__govtrace_db
}

export type Db = ReturnType<typeof getDb>
export type Schema = typeof schema
