import { Skeleton } from '@/components/ui/skeleton'
import type { PlatformStats } from '@/server-fns/stats'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

type StatChipsProps = { stats: PlatformStats | null }

export function StatChips({ stats }: StatChipsProps) {
  if (!stats) {
    return (
      <div className="flex flex-wrap justify-center gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-32" />
        ))}
      </div>
    )
  }

  const chips = [
    { value: formatCount(stats.totalDonations), label: 'donations tracked' },
    { value: formatCount(stats.totalContracts), label: 'contracts indexed' },
    { value: formatCount(stats.totalGrants), label: 'grants recorded' },
    { value: formatCount(stats.totalLobbying), label: 'lobbying activities' },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {chips.map((chip) => (
        <div key={chip.label} className="flex flex-col items-center">
          <span className="text-xl font-semibold">{chip.value}</span>
          <span className="text-sm text-muted-foreground">{chip.label}</span>
        </div>
      ))}
    </div>
  )
}
