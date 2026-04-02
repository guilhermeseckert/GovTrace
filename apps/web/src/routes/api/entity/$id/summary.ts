import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getOrGenerateSummary } from '@/server-fns/summary'

// GET /api/entity/:id/summary — generates or returns cached AI summary (API-05)
export const APIRoute = createAPIFileRoute('/api/entity/$id/summary')({
  GET: async ({ params }) => {
    const summary = await getOrGenerateSummary({ data: { entityId: params.id } })
    if (!summary) {
      return Response.json({ error: 'Entity not found' }, { status: 404 })
    }
    return Response.json({ summary })
  },
})
