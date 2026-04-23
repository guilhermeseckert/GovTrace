import { createServerFn } from '@tanstack/react-start'
import { count, sql } from 'drizzle-orm'
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
  totalDonationsValue: number
  totalContractsValue: number
  totalGrantsValue: number
}

export const getPlatformStats = createServerFn({ method: 'GET' }).handler(() =>
  cached('platform-stats', async () => {
    const db = getDb()

    const [
      entityCount,
      donationCount,
      contractCount,
      grantCount,
      lobbyCount,
      donationSum,
      contractSum,
      grantSum,
    ] = await Promise.all([
      db.select({ c: count() }).from(entities),
      db.select({ c: count() }).from(donations),
      db.select({ c: count() }).from(contracts),
      db.select({ c: count() }).from(grants),
      db.select({ c: count() }).from(lobbyRegistrations),
      db.select({ v: sql<string>`COALESCE(SUM(${donations.amount}), 0)::text` }).from(donations),
      db.select({ v: sql<string>`COALESCE(SUM(${contracts.value}), 0)::text` }).from(contracts),
      db.select({ v: sql<string>`COALESCE(SUM(${grants.amount}), 0)::text` }).from(grants),
    ])

    return {
      totalEntities: Number(entityCount[0]?.c ?? 0),
      totalDonations: Number(donationCount[0]?.c ?? 0),
      totalContracts: Number(contractCount[0]?.c ?? 0),
      totalGrants: Number(grantCount[0]?.c ?? 0),
      totalLobbying: Number(lobbyCount[0]?.c ?? 0),
      totalDonationsValue: Number(donationSum[0]?.v ?? 0),
      totalContractsValue: Number(contractSum[0]?.v ?? 0),
      totalGrantsValue: Number(grantSum[0]?.v ?? 0),
    } satisfies PlatformStats
  }),
)
