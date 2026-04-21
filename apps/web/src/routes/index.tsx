import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileText, Gift, TrendingUp, Globe, Vote, Users, ExternalLink, BookOpen } from 'lucide-react'
import { getPlatformStats } from '@/server-fns/stats'
import { getLandingData } from '@/server-fns/landing'
import { getDebtHeroStats } from '@/server-fns/dashboard'
import { HeroSearch } from '@/components/landing/HeroSearch'
import { getDepartmentName } from '@/lib/department-codes'
import { Skeleton } from '@/components/ui/skeleton'
import type { RecentActivity, TopRecipient } from '@/server-fns/landing'
import type { DebtHeroStats } from '@/server-fns/dashboard'

const FIVE_MINUTES = 1000 * 60 * 5
const ONE_HOUR = 1000 * 60 * 60

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const { queryClient } = context
    await Promise.all([
      queryClient
        .ensureQueryData({
          queryKey: ['platform-stats'],
          queryFn: () => getPlatformStats(),
          staleTime: FIVE_MINUTES,
        })
        .catch((err: unknown) => {
          console.error('[home-loader] platform-stats prefetch failed', err)
        }),
      queryClient
        .ensureQueryData({
          queryKey: ['landing-data'],
          queryFn: () => getLandingData(),
          staleTime: FIVE_MINUTES,
        })
        .catch((err: unknown) => {
          console.error('[home-loader] landing-data prefetch failed', err)
        }),
      queryClient
        .ensureQueryData({
          queryKey: ['debt-hero-stats'],
          queryFn: () => getDebtHeroStats(),
          staleTime: ONE_HOUR,
        })
        .catch((err: unknown) => {
          console.error('[home-loader] debt-hero-stats prefetch failed', err)
        }),
    ])
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
        <div className="truncate text-sm font-medium group-hover:text-primary group-hover:underline">{item.entityName}</div>
        {item.department && (
          <div className="truncate text-xs text-muted-foreground">{getDepartmentName(item.department ?? '')}</div>
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
      <Link to="/entity/$id" params={{ id: item.entityId }} className="block cursor-pointer">
        {content}
      </Link>
    )
  }

  // No entity linked yet — link to search for the name
  return (
    <Link to="/search" search={{ q: item.entityName ?? '' }} className="block cursor-pointer">
      {content}
    </Link>
  )
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
                <span className="truncate text-sm font-medium group-hover:text-primary group-hover:underline">{item.name}</span>
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
              <Link key={item.entityId} to="/entity/$id" params={{ id: item.entityId }} className="block cursor-pointer">
                {content}
              </Link>
            )
          }
          return (
            <Link key={`${item.name}-${i}`} to="/search" search={{ q: item.name }} className="block cursor-pointer">
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const FEATURE_CARDS = [
  {
    title: 'Where your tax dollars go overseas',
    description: 'See how much Canada spends on international aid, which departments authorize it, and how it compares to the national debt.',
    Icon: Globe,
    iconColor: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
    href: '/dashboard',
    cta: 'View the dashboard',
  },
  {
    title: 'How your MP voted',
    description: 'Search any politician and see every bill they voted on — then see who donated to them and who lobbied them.',
    Icon: Vote,
    iconColor: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    href: '/search',
    cta: 'Search a politician',
  },
  {
    title: "Who's connected to whom",
    description: 'Type any name and instantly see the full picture — donations, contracts, lobbying, grants, and international aid in one place.',
    Icon: Users,
    iconColor: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
    href: '/search',
    cta: 'Search a name',
  },
] as const

function formatBillions(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}T`
  if (n >= 1) return `$${n.toFixed(1)}B`
  return `$${(n * 1000).toFixed(0)}M`
}

function DebtPreview({ debtStats }: { debtStats: DebtHeroStats }) {
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Globe className="h-5 w-5 text-rose-500" />
          <h2 className="font-serif text-2xl">Debt vs Overseas Spending</h2>
        </div>
        <p className="mb-10 text-center text-sm text-muted-foreground">
          How much does Canada send overseas relative to the national debt? Every number links to the original government source.
        </p>

        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-3">
          <a
            href={debtStats.sourceDebtUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer rounded-xl border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-md"
          >
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">National Debt</p>
            <p className="text-3xl font-bold tabular-nums">{formatBillions(debtStats.currentDebtBillions)}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
              <ExternalLink className="h-3 w-3" />
              Statistics Canada
            </p>
          </a>

          <a
            href={debtStats.sourceAidUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer rounded-xl border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-md"
          >
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Overseas Aid</p>
            <p className="text-3xl font-bold tabular-nums">{formatBillions(debtStats.totalAidBillions)}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
              <ExternalLink className="h-3 w-3" />
              Global Affairs Canada
            </p>
          </a>

          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Aid as % of Debt</p>
            <p className="text-3xl font-bold tabular-nums">{debtStats.aidAsPercentOfDebt.toFixed(2)}%</p>
            <p className="mt-2 text-xs text-muted-foreground">
              As of {new Date(debtStats.debtAsOf).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:underline"
          >
            See the full dashboard with historical trends
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function IndexPage() {
  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => getPlatformStats(),
    staleTime: 1000 * 60 * 5,
  })
  const { data: landing } = useQuery({
    queryKey: ['landing-data'],
    queryFn: () => getLandingData(),
    staleTime: 1000 * 60 * 5,
  })
  const { data: debtStats } = useQuery({
    queryKey: ['debt-hero-stats'],
    queryFn: () => getDebtHeroStats(),
    staleTime: 1000 * 60 * 60,
  })

  return (
    <main id="main-content">
      <HeroSearch stats={stats} />

      {/* Feature cards */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-2 text-center font-serif text-3xl">What can you find?</h2>
        <p className="mb-10 text-center text-muted-foreground">
          Seven public datasets. One search bar. The full picture.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.title}
              to={card.href}
              className="group cursor-pointer rounded-xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className={`mb-4 inline-flex rounded-lg p-2.5 ${card.iconColor}`}>
                <card.Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{card.title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:underline">
                {card.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Debt vs Aid preview */}
      {debtStats && <DebtPreview debtStats={debtStats} />}

      {/* Live data section */}
      {landing && (
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16">
            <div className="mb-8 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-2xl">Where the money is going</h2>
            </div>

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

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Recent Contracts
                  </h3>
                </div>
                <div className="divide-y rounded-lg border bg-card">
                  {landing.recentContracts.map((item, i) => (
                    <ActivityRow key={`c-${i}`} item={item} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Recent Grants
                  </h3>
                </div>
                <div className="divide-y rounded-lg border bg-card">
                  {landing.recentGrants.map((item, i) => (
                    <ActivityRow key={`g-${i}`} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Trust / Source section */}
      <section className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <h2 className="mb-3 font-serif text-2xl">Open data. Zero editorializing.</h2>
          <p className="mx-auto mb-8 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Every connection on GovTrace links to the original government source.
            We show the data — you decide what it means.
          </p>
          <div className="mx-auto mb-8 flex max-w-2xl flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border px-3 py-1">Elections Canada</span>
            <span className="rounded-full border px-3 py-1">Federal Contracts</span>
            <span className="rounded-full border px-3 py-1">Federal Grants</span>
            <span className="rounded-full border px-3 py-1">Lobbyist Registry</span>
            <span className="rounded-full border px-3 py-1">Lobby Communications</span>
            <span className="rounded-full border px-3 py-1">International Aid (IATI)</span>
            <span className="rounded-full border px-3 py-1">House of Commons Votes</span>
          </div>
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:underline"
          >
            <BookOpen className="h-4 w-4" />
            Learn how it works
          </Link>
        </div>
      </section>
    </main>
  )
}
