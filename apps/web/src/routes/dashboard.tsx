import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  getDebtTimeline,
  getDepartmentBreakdown,
  getDebtHeroStats,
  getCountryBreakdown,
  getSectorBreakdown,
  getSpendingByCategory,
  getRecentSpendingAnnouncements,
  getTopRecipientsWithConnections,
} from '@/server-fns/dashboard'
import { RightNow } from '@/components/dashboard/RightNow'
import { BigPicture } from '@/components/dashboard/BigPicture'
import { WhereMoneyGoes } from '@/components/dashboard/WhereMoneyGoes'
import { WhoGetsTheMost } from '@/components/dashboard/WhoGetsTheMost'
import { DeepDive } from '@/components/dashboard/DeepDive'
import { DataFreshness } from '@/components/dashboard/DataFreshness'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: heroStats } = useQuery({
    queryKey: ['debt-hero-stats'],
    queryFn: () => getDebtHeroStats(),
    staleTime: 1000 * 60 * 60,
  })
  const { data: timeline } = useQuery({
    queryKey: ['debt-timeline'],
    queryFn: () => getDebtTimeline(),
    staleTime: 1000 * 60 * 60,
  })
  const { data: departments } = useQuery({
    queryKey: ['dept-breakdown'],
    queryFn: () => getDepartmentBreakdown(),
    staleTime: 1000 * 60 * 60,
  })
  const { data: countries } = useQuery({
    queryKey: ['country-breakdown'],
    queryFn: () => getCountryBreakdown(),
    staleTime: 1000 * 60 * 60,
  })
  const { data: sectors } = useQuery({
    queryKey: ['sector-breakdown'],
    queryFn: () => getSectorBreakdown(),
    staleTime: 1000 * 60 * 60,
  })
  const { data: spendingByCategory } = useQuery({
    queryKey: ['spending-by-category'],
    queryFn: () => getSpendingByCategory(),
    staleTime: 1000 * 60 * 60,
  })
  const { data: recentSpending } = useQuery({
    queryKey: ['recent-spending-announcements'],
    queryFn: () => getRecentSpendingAnnouncements(),
    staleTime: 1000 * 60 * 30,
  })
  const { data: topRecipients } = useQuery({
    queryKey: ['top-recipients-connections'],
    queryFn: () => getTopRecipientsWithConnections(),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Follow the Money</h1>
        <p className="max-w-2xl text-muted-foreground">
          How Canada spends your tax dollars — told like a story.
        </p>
      </div>

      {recentSpending && recentSpending.length > 0 && (
        <RightNow data={recentSpending} />
      )}

      {heroStats && <BigPicture stats={heroStats} />}

      {spendingByCategory && <WhereMoneyGoes data={spendingByCategory} />}

      <WhoGetsTheMost data={topRecipients} />

      <DeepDive
        timeline={timeline}
        departments={departments}
        countries={countries}
        sectors={sectors}
        spendingByCategory={spendingByCategory}
      />

      <DataFreshness />

      <footer className="border-t pt-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Data Notes</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            Aid figures show project start year. Disbursements may span multiple fiscal years.
          </li>
          <li>
            Government of Canada uses an April–March fiscal year. Debt figures are on a
            calendar-year basis (most recent month per year).
          </li>
          <li>
            Source: Statistics Canada Table 10-10-0002-01, Global Affairs Canada IATI Activity
            Files.
          </li>
          <li>
            Connections shown do not imply wrongdoing. All data under the Open Government
            Licence — Canada.
          </li>
        </ul>
      </footer>
    </main>
  )
}
