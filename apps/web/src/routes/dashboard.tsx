import { createFileRoute } from '@tanstack/react-router'
import { getDebtTimeline, getDepartmentBreakdown, getDebtHeroStats } from '@/server-fns/dashboard'
import { DebtHeroStats } from '@/components/dashboard/DebtHeroStats'
import { DebtVsAidChart } from '@/components/dashboard/DebtVsAidChart'
import { DepartmentBreakdown } from '@/components/dashboard/DepartmentBreakdown'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const [timeline, departments, heroStats] = await Promise.all([
      getDebtTimeline(),
      getDepartmentBreakdown(),
      getDebtHeroStats(),
    ])
    return { timeline, departments, heroStats }
  },
  component: DashboardPage,
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardPage() {
  const { timeline, departments, heroStats } = Route.useLoaderData()

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      {/* Page header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Debt vs Overseas Spending
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          How much does Canada send overseas relative to the national debt? Every
          number links back to the original government source.
        </p>
      </div>

      {/* Section 1: Hero stats */}
      <section aria-labelledby="hero-stats-heading">
        <h2 id="hero-stats-heading" className="mb-4 text-lg font-semibold">
          At a Glance
        </h2>
        <DebtHeroStats stats={heroStats} />
      </section>

      {/* Section 2: Time-series chart */}
      <section aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="mb-4 text-lg font-semibold">
          Debt and Aid Over Time
        </h2>
        <DebtVsAidChart data={timeline} />
      </section>

      {/* Section 3: Department breakdown */}
      <section aria-labelledby="dept-heading">
        <h2 id="dept-heading" className="mb-4 text-lg font-semibold">
          Spending by Department
        </h2>
        <DepartmentBreakdown data={departments} />
      </section>

      {/* Footnotes */}
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
