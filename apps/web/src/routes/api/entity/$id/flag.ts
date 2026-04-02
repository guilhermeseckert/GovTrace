import { createAPIFileRoute } from '@tanstack/react-start/api'
import { z } from 'zod'
import { getDb } from '@govtrace/db/client'
import { flags } from '@govtrace/db/schema/entities'

const FlagBodySchema = z.object({
  // FK to entityMatchesLog — links flag to a specific match decision (COMM-03)
  matchLogId: z.string().uuid().optional(),
  description: z.string().min(10).max(1000),
  reporterEmail: z.string().email().optional(),
})

// POST /api/entity/:id/flag — accepts anonymous flag submissions (API-12, COMM-01)
// No authentication required — public data, community correction system
export const APIRoute = createAPIFileRoute('/api/entity/$id/flag')({
  POST: async ({ request, params }) => {
    const body = await request.json().catch(() => null)
    const parsed = FlagBodySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const db = getDb()
    await db.insert(flags).values({
      entityId: params.id,
      matchLogId: parsed.data.matchLogId ?? null,  // COMM-03
      description: parsed.data.description,
      reporterEmail: parsed.data.reporterEmail ?? null,  // COMM-02
      status: 'pending',
    })

    return Response.json({ success: true }, { status: 201 })
  },
})
