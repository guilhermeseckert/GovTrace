import { DollarSign, FileText, Gift, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { PlatformStats } from '@/server-fns/stats'
import type { ReactNode } from 'react'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

function formatDollars(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

type StatChipsProps = { stats: PlatformStats | null }

type ChipData = {
  headline: string
  label: string
  sub: string
  icon: ReactNode
  delay: string
}

export function StatChips({ stats }: StatChipsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const chips: ChipData[] = [
    {
      headline: formatDollars(stats.totalDonationsValue),
      label: 'Donations',
      sub: `${formatCount(stats.totalDonations)} records`,
      icon: <DollarSign className="h-4 w-4" />,
      delay: '0s',
    },
    {
      headline: formatDollars(stats.totalContractsValue),
      label: 'Contracts',
      sub: `${formatCount(stats.totalContracts)} records`,
      icon: <FileText className="h-4 w-4" />,
      delay: '0.1s',
    },
    {
      headline: formatDollars(stats.totalGrantsValue),
      label: 'Grants',
      sub: `${formatCount(stats.totalGrants)} records`,
      icon: <Gift className="h-4 w-4" />,
      delay: '0.2s',
    },
    {
      headline: formatCount(stats.totalLobbying),
      label: 'Lobbying',
      sub: 'registrations',
      icon: <Users className="h-4 w-4" />,
      delay: '0.3s',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="gt-stat-enter flex flex-col items-center gap-1 rounded-lg border bg-card/60 px-4 py-4 backdrop-blur-sm"
          style={{ animationDelay: chip.delay }}
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {chip.icon}
            <span className="text-xs font-medium uppercase tracking-wider">{chip.label}</span>
          </div>
          <span className="tabular-nums text-2xl font-medium tracking-tight">{chip.headline}</span>
          <span className="tabular-nums text-xs text-muted-foreground/70">{chip.sub}</span>
        </div>
      ))}
    </div>
  )
}
