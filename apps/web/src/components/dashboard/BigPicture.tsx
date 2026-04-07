import { ExternalLink } from 'lucide-react'
import type { DebtHeroStats } from '@/server-fns/dashboard'

const CANADA_POPULATION = 41_000_000

function formatDebtLarge(billions: number): string {
  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(1)} trillion`
  }
  return `$${billions.toFixed(1)} billion`
}

function formatPerCapita(billions: number): string {
  const totalDollars = billions * 1_000_000_000
  const perPerson = totalDollars / CANADA_POPULATION
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(perPerson)
}

function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })
}

type Props = {
  stats: DebtHeroStats
}

export function BigPicture({ stats }: Props) {
  return (
    <section aria-labelledby="big-picture-heading">
      <h2 id="big-picture-heading" className="mb-1 text-2xl font-bold tracking-tight">
        The Big Picture
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Canada&apos;s national debt — the accumulated total of all federal deficits
      </p>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">National Debt</p>
        <p className="mt-1 text-4xl font-black tabular-nums text-destructive md:text-5xl">
          {stats.currentDebtBillions > 0 ? formatDebtLarge(stats.currentDebtBillions) : '—'}
        </p>
        {stats.currentDebtBillions > 0 && (
          <p className="mt-3 text-base text-muted-foreground">
            That&apos;s about{' '}
            <span className="font-semibold text-foreground">
              {formatPerCapita(stats.currentDebtBillions)}
            </span>{' '}
            per Canadian.
          </p>
        )}
        {stats.debtAsOf && (
          <p className="mt-2 text-xs text-muted-foreground">
            As of {formatDate(stats.debtAsOf)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Overseas Aid Committed</span>
            <span className="font-semibold tabular-nums">
              {stats.totalAidBillions > 0
                ? `$${stats.totalAidBillions.toFixed(1)} billion`
                : '—'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Aid as % of Debt</span>
            <span className="font-semibold tabular-nums">
              {stats.aidAsPercentOfDebt > 0
                ? `${stats.aidAsPercentOfDebt.toFixed(1)}%`
                : '—'}
            </span>
          </div>
        </div>
        <div className="mt-4 border-t pt-3">
          <a
            href={stats.sourceDebtUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Source: Statistics Canada Table 10-10-0002-01
          </a>
        </div>
      </div>
    </section>
  )
}
