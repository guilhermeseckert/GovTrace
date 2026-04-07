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
} from '@/server-fns/dashboard'
import { DebtHeroStats } from '@/components/dashboard/DebtHeroStats'
import { DebtVsAidChart } from '@/components/dashboard/DebtVsAidChart'
import { DepartmentBreakdown } from '@/components/dashboard/DepartmentBreakdown'
import { CountryBreakdown } from '@/components/dashboard/CountryBreakdown'
import { SectorBreakdown } from '@/components/dashboard/SectorBreakdown'
import { SpendingByCategory } from '@/components/dashboard/SpendingByCategory'
import { RecentSpending } from '@/components/dashboard/RecentSpending'
import { Skeleton } from '@/components/ui/skeleton'

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

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Debt vs Overseas Spending
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          How much does Canada send overseas relative to the national debt? Every
          number links back to the original government source.
        </p>
      </div>

      <section aria-labelledby="hero-stats-heading">
        <h2 id="hero-stats-heading" className="mb-4 text-lg font-semibold">
          At a Glance
        </h2>
        {heroStats ? (
          <DebtHeroStats stats={heroStats} />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        )}
      </section>

      {recentSpending && recentSpending.length > 0 && (
        <section aria-labelledby="recent-spending-heading">
          <h2 id="recent-spending-heading" className="mb-1 text-lg font-semibold">
            Recent Spending Announcements
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Latest government press releases mentioning dollar amounts — near-real-time data from canada.ca.
          </p>
          <RecentSpending data={recentSpending} />
        </section>
      )}

      <section aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="mb-4 text-lg font-semibold">
          Debt and Aid Over Time
        </h2>
        {timeline ? (
          <DebtVsAidChart data={timeline} />
        ) : (
          <Skeleton className="h-[400px] rounded-lg" />
        )}
      </section>

      <section aria-labelledby="spending-category-heading">
        <h2 id="spending-category-heading" className="mb-1 text-lg font-semibold">
          Federal Spending by Category
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          How the government allocates its budget across standard expenditure objects (latest fiscal year).
        </p>
        {spendingByCategory ? (
          <SpendingByCategory data={spendingByCategory} />
        ) : (
          <Skeleton className="h-64 rounded-lg" />
        )}
      </section>

      <section aria-labelledby="dept-heading">
        <h2 id="dept-heading" className="mb-4 text-lg font-semibold">
          Spending by Department
        </h2>
        {departments ? (
          <DepartmentBreakdown data={departments} />
        ) : (
          <Skeleton className="h-48 rounded-lg" />
        )}
      </section>

      <section aria-labelledby="country-heading">
        <h2 id="country-heading" className="mb-4 text-lg font-semibold">
          Aid by Recipient Country
        </h2>
        {countries ? (
          <CountryBreakdown data={countries} />
        ) : (
          <Skeleton className="h-64 rounded-lg" />
        )}
      </section>

      <section aria-labelledby="sector-heading">
        <h2 id="sector-heading" className="mb-4 text-lg font-semibold">
          Aid by Theme
        </h2>
        {sectors ? (
          <SectorBreakdown data={sectors} />
        ) : (
          <Skeleton className="h-48 rounded-lg" />
        )}
      </section>

      <footer className="border-t pt-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Data Notes
        </h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            Aid figures show project start year. Disbursements may span multiple
            fiscal years.
          </li>
          <li>
            Government of Canada uses an April–March fiscal year. Debt figures
            are on a calendar-year basis (most recent month per year).
          </li>
          <li>
            Source: Statistics Canada Table 10-10-0002-01, Global Affairs Canada
            IATI Activity Files.
          </li>
          <li>
            Connections shown do not imply wrongdoing. All data under the Open
            Government Licence — Canada.
          </li>
        </ul>
      </footer>
    </main>
  )
}
