import { ExternalLink } from 'lucide-react'
import { bucketizeSpending } from '@/server-fns/dashboard'
import type { SpendingCategoryRow } from '@/server-fns/dashboard'

const PA_DATASET_URL =
  'https://open.canada.ca/data/en/dataset/a35cf382-690c-4221-a971-cf0fd189a46f'

function formatCurrency(dollars: number): string {
  const abs = Math.abs(dollars)
  const sign = dollars < 0 ? '-' : ''
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}K`
  }
  return `${sign}$${abs.toFixed(0)}`
}

type Props = {
  data: SpendingCategoryRow[]
}

export function WhereMoneyGoes({ data }: Props) {
  const buckets = bucketizeSpending(data.filter((r) => r.amount > 0))

  if (buckets.length === 0) {
    return null
  }

  const maxAmount = buckets[0]?.amount ?? 1

  return (
    <section aria-labelledby="where-money-goes-heading">
      <h2 id="where-money-goes-heading" className="mb-1 text-2xl font-bold tracking-tight">
        Where the Money Goes
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Federal spending simplified into plain English (latest fiscal year)
      </p>

      <div className="space-y-4">
        {buckets.map((item) => {
          const barWidth = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0
          return (
            <div key={item.bucket} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold">{item.bucket}</span>
                <span className="shrink-0 text-xl font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-secondary"
                role="img"
                aria-label={`${item.bucket}: ${formatCurrency(item.amount)}`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t pt-3">
        <a
          href={PA_DATASET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Source: Public Accounts of Canada — Expenditures by Standard Object
        </a>
      </div>
    </section>
  )
}
