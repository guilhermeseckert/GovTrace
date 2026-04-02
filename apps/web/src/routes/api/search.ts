import { createAPIFileRoute } from '@tanstack/react-start/api'
import { searchEntities } from '@/server-fns/search'

export const APIRoute = createAPIFileRoute('/api/search')({
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q') ?? ''
    const type = (url.searchParams.get('type') ?? 'all') as
      | 'all'
      | 'politician'
      | 'company'
      | 'person'
      | 'organization'
      | 'department'
    const province = url.searchParams.get('province') ?? undefined
    const page = Number(url.searchParams.get('page') ?? '1')

    if (!query) {
      return Response.json({ error: 'q parameter is required' }, { status: 400 })
    }

    const results = await searchEntities({
      data: { query, type, province, page },
    })
    return Response.json(results)
  },
})
