import { SearchBar } from '@/components/search/SearchBar'
import { StatChips } from '@/components/landing/StatChips'
import { en } from '@/i18n/en'
import type { PlatformStats } from '@/server-fns/stats'

type HeroSearchProps = { stats: PlatformStats | null }

export function HeroSearch({ stats }: HeroSearchProps) {
  return (
    <section className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-center text-[28px] font-semibold leading-[1.15]">
          {en.landing.tagline}
        </h1>
        <SearchBar autoFocus />
        <StatChips stats={stats} />
      </div>
    </section>
  )
}
