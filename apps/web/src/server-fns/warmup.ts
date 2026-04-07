import { createServerFn } from '@tanstack/react-start'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

/**
 * Warms up the PostgreSQL connection pool on the first request.
 * Calling getDb() creates the pool and fires a SELECT 1 internally,
 * but this server function ensures the warm-up happens on the server
 * side during the root loader so data queries on first navigation are fast.
 */
export const warmupDb = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  await db.execute(sql`SELECT 1`)
})
