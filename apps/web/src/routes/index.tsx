import { createFileRoute } from '@tanstack/react-router'
import { getPlatformStats } from '@/server-fns/stats'
import { HeroSearch } from '@/components/landing/HeroSearch'

export const Route = createFileRoute('/')({
  loader: async () => {
    const stats = await getPlatformStats()
    return { stats }
  },
  component: IndexPage,
})

function IndexPage() {
  const { stats } = Route.useLoaderData()
  return (
    <main id="main-content">
      <HeroSearch stats={stats} />
    </main>
  )
}
