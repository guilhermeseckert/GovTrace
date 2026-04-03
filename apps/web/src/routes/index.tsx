import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { ArrowRight, FileText, Gift, TrendingUp } from 'lucide-react'
import { getPlatformStats } from '@/server-fns/stats'
import { getLandingData } from '@/server-fns/landing'
import { HeroSearch } from '@/components/landing/HeroSearch'
import type { RecentActivity, TopRecipient } from '@/server-fns/landing'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [stats, landing] = await Promise.all([
      getPlatformStats(),
      getLandingData(),
    ])
    return { stats, landing }
  },
  component: IndexPage,
})

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ActivityRow({ item }: { item: RecentActivity }) {
  const Icon = item.type === 'contract' ? FileText : Gift
  const iconColor = item.type === 'contract' ? 'text-emerald-500' : 'text-amber-500'

  const content = (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50">
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{item.entityName}</div>
        {item.department && (
          <div className="truncate text-xs text-muted-foreground">{item.department}</div>
        )}
      </div>
      {item.amount && (
        <span className="shrink-0 tabular-nums text-sm font-medium">
          {formatAmount(item.amount)}
        </span>
      )}
      {item.date && (
        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.date)}</span>
      )}
    </div>
  )

  if (item.entityId) {
    return (
      <Link to="/entity/$id" params={{ id: item.entityId }}>
        {content}
      </Link>
    )
  }
  return content
}

function TopList({ items, title, icon }: { items: TopRecipient[]; title: string; icon: React.ReactNode }) {
  const maxValue = Math.max(...items.map((i) => i.totalValue))

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pct = maxValue > 0 ? (item.totalValue / maxValue) * 100 : 0
          const content = (
            <div className="group rounded-md px-3 py-2 transition-colors hover:bg-muted/50">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="shrink-0 tabular-nums text-sm">{formatAmount(item.totalValue)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.contractCount} {item.contractCount === 1 ? 'record' : 'records'}
              </div>
            </div>
          )

          if (item.entityId) {
            return (
              <Link key={item.entityId} to="/entity/$id" params={{ id: item.entityId }}>
                {content}
              </Link>
            )
          }
          return <div key={`${item.name}-${i}`}>{content}</div>
        })}
      </div>
    </div>
  )
}

function IndexPage() {
  const { stats, landing } = Route.useLoaderData()

  return (
    <main id="main-content">
      <HeroSearch stats={stats} />

      {/* Live data section */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-8 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-2xl">Where the money is going</h2>
        </div>

        {/* Top recipients */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          <TopList
            items={landing.topContractors}
            title="Top Government Contractors"
            icon={<FileText className="h-4 w-4 text-emerald-500" />}
          />
          <TopList
            items={landing.topGrantRecipients}
            title="Top Grant Recipients"
            icon={<Gift className="h-4 w-4 text-amber-500" />}
          />
        </div>

        {/* Recent activity */}
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Recent Contracts
                </h3>
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {landing.recentContracts.map((item, i) => (
                <ActivityRow key={`c-${i}`} item={item} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Recent Grants
                </h3>
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {landing.recentGrants.map((item, i) => (
                <ActivityRow key={`g-${i}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
