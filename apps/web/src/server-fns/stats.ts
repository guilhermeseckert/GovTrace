import { createServerFn } from '@tanstack/react-start'
import { count } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entities } from '@govtrace/db/schema/entities'
import { donations, contracts, grants, lobbyRegistrations } from '@govtrace/db/schema/raw'
import { cached } from '@/lib/cache'

export type PlatformStats = {
  totalEntities: number
  totalDonations: number
  totalContracts: number
  totalGrants: number
  totalLobbying: number
}

export const getPlatformStats = createServerFn({ method: 'GET' }).handler(() =>
  cached('platform-stats', async () => {
    const db = getDb()

    const [entityCount, donationCount, contractCount, grantCount, lobbyCount] = await Promise.all([
      db.select({ c: count() }).from(entities),
      db.select({ c: count() }).from(donations),
      db.select({ c: count() }).from(contracts),
      db.select({ c: count() }).from(grants),
      db.select({ c: count() }).from(lobbyRegistrations),
    ])

    return {
      totalEntities: Number(entityCount[0]?.c ?? 0),
      totalDonations: Number(donationCount[0]?.c ?? 0),
      totalContracts: Number(contractCount[0]?.c ?? 0),
      totalGrants: Number(grantCount[0]?.c ?? 0),
      totalLobbying: Number(lobbyCount[0]?.c ?? 0),
    } satisfies PlatformStats
  }),
)
