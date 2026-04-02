import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getContracts } from '../../../../server-fns/datasets'

// GET /api/entity/:id/contracts — paginated contracts (API-03)
export const APIRoute = createAPIFileRoute('/api/entity/$id/contracts')({
  GET: async ({ request, params }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    const pageSize = Number(url.searchParams.get('pageSize') ?? '25')
    const sortBy = url.searchParams.get('sortBy') ?? undefined
    const sortDir = (url.searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'
    const result = await getContracts({ data: { entityId: params.id, page, pageSize, sortBy, sortDir } })
    return Response.json(result)
  },
})
