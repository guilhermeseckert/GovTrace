import { SearchBar } from '@/components/search/SearchBar'
import { StatChips } from '@/components/landing/StatChips'
import type { PlatformStats } from '@/server-fns/stats'

type HeroSearchProps = { stats: PlatformStats | null }

export function HeroSearch({ stats }: HeroSearchProps) {
  return (
    <section className="gt-hero-pattern relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 gt-grid-bg opacity-40" />

      <div className="relative w-full max-w-2xl space-y-10">
        {/* Eyebrow */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Tracking 7 public federal datasets
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-4 text-center">
          <h1 className="font-serif text-4xl leading-[1.1] sm:text-5xl md:text-6xl">
            Follow the money.
            <br />
            <span className="italic text-primary">Connect the dots.</span>
          </h1>
          <p className="mx-auto max-w-md text-base text-muted-foreground sm:text-lg">
            Search any politician, company, or person — instantly see their donations,
            contracts, lobbying, grants, international aid, and how they voted in Parliament.
          </p>
        </div>

        {/* Search */}
        <div className="mx-auto max-w-xl">
          <SearchBar autoFocus />
        </div>

        {/* Stats */}
        <StatChips stats={stats} />

        {/* Bottom attribution */}
        <p className="text-center text-xs text-muted-foreground/60">
          All data from Elections Canada, open.canada.ca, lobbycanada.gc.ca, and ourcommons.ca
        </p>
      </div>
    </section>
  )
}
