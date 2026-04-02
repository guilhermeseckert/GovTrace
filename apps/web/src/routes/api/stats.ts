import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getPlatformStats } from '@/server-fns/stats'

export const APIRoute = createAPIFileRoute('/api/stats')({
  GET: async () => {
    const stats = await getPlatformStats()
    return Response.json(stats)
  },
})
