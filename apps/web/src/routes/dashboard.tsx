import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getDebtTimeline, getDepartmentBreakdown, getDebtHeroStats } from '@/server-fns/dashboard'
import { DebtHeroStats } from '@/components/dashboard/DebtHeroStats'
import { DebtVsAidChart } from '@/components/dashboard/DebtVsAidChart'
import { DepartmentBreakdown } from '@/components/dashboard/DepartmentBreakdown'
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
