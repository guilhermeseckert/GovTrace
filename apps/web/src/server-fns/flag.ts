import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '@govtrace/db/client'
import { flags } from '@govtrace/db/schema/entities'

const FlagInputSchema = z.object({
  entityId: z.string().uuid(),
  // FK to entityMatchesLog — populated when flag is linked to a specific match decision (COMM-03)
  matchLogId: z.string().uuid().optional(),
  description: z.string().min(10).max(1000),
  // Optional reporter email for follow-up (COMM-02); empty string treated as undefined
  reporterEmail: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
})

export const submitFlag = createServerFn({ method: 'POST' })
  .validator((data: unknown) => FlagInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()
    await db.insert(flags).values({
      entityId: data.entityId,
      matchLogId: data.matchLogId ?? null,  // COMM-03: link flag to specific match decision
      description: data.description,
      reporterEmail: data.reporterEmail ?? null,  // COMM-02: optional for anonymous submissions
      status: 'pending',
    })
    return { success: true }
  })
