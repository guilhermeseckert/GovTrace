import { ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SpendingByCategory } from '@/components/dashboard/SpendingByCategory'
import { DebtVsAidChart } from '@/components/dashboard/DebtVsAidChart'
import { DepartmentBreakdown } from '@/components/dashboard/DepartmentBreakdown'
import { CountryBreakdown } from '@/components/dashboard/CountryBreakdown'
import { SectorBreakdown } from '@/components/dashboard/SectorBreakdown'
import type {
  DebtAidDataPoint,
  DeptSpendingRow,
  CountrySpendingRow,
  SectorSpendingRow,
  SpendingCategoryRow,
} from '@/server-fns/dashboard'

type Props = {
  timeline?: DebtAidDataPoint[]
  departments?: DeptSpendingRow[]
  countries?: CountrySpendingRow[]
  sectors?: SectorSpendingRow[]
  spendingByCategory?: SpendingCategoryRow[]
}

export function DeepDive({ timeline, departments, countries, sectors, spendingByCategory }: Props) {
  return (
    <section aria-labelledby="deep-dive-heading">
      <details className="group rounded-xl border bg-card">
        <summary
          className="flex cursor-pointer list-none items-center justify-between p-5 transition-colors duration-200 hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <h2 id="deep-dive-heading" className="text-xl font-bold tracking-tight">
              Deep Dive
            </h2>
            <p className="text-sm text-muted-foreground">Charts &amp; detailed breakdowns for power users</p>
          </div>
          <ChevronDown
            className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-10 p-5 pt-0">
          {/* Spending by Standard Object (detailed) */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">
              Spending by Standard Object (Detailed)
            </h3>
            {spendingByCategory ? (
              <SpendingByCategory data={spendingByCategory} />
            ) : (
              <Skeleton className="h-64 rounded-lg" />
            )}
          </div>

          {/* Debt and Aid Over Time */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">Debt and Aid Over Time</h3>
            {timeline ? (
              <DebtVsAidChart data={timeline} />
            ) : (
              <Skeleton className="h-[400px] rounded-lg" />
            )}
          </div>

          {/* Spending by Department */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">Overseas Aid by Department</h3>
            {departments ? (
              <DepartmentBreakdown data={departments} />
            ) : (
              <Skeleton className="h-48 rounded-lg" />
            )}
          </div>

          {/* Aid by Recipient Country */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">Aid by Recipient Country</h3>
            {countries ? (
              <CountryBreakdown data={countries} />
            ) : (
              <Skeleton className="h-64 rounded-lg" />
            )}
          </div>

          {/* Aid by Sector / Theme */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">Aid by Theme</h3>
            {sectors ? (
              <SectorBreakdown data={sectors} />
            ) : (
              <Skeleton className="h-48 rounded-lg" />
            )}
          </div>
        </div>
      </details>
    </section>
  )
}
