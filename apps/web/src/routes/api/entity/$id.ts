import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getEntityProfile } from '../../../server-fns/entity'
import { getEntityStats } from '../../../server-fns/entity'

// GET /api/entity/:id — full entity profile with stats (API-02)
export const APIRoute = createAPIFileRoute('/api/entity/$id')({
  GET: async ({ params }) => {
    const profile = await getEntityProfile({ data: { id: params.id } })
    if (!profile) {
      return Response.json({ error: 'Entity not found' }, { status: 404 })
    }
    const stats = await getEntityStats({ data: { id: params.id } })
    return Response.json({ ...profile, stats })
  },
})
