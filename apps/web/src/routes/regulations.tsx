import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, ChevronDown, ChevronRight, Search, FileText, Building2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getRegulations,
  getRegulationLobbyingLinks,
  getRegulationStats,
  getDepartmentList,
} from '@/server-fns/gazette'
import type { RegulationRow } from '@/server-fns/gazette'
import { DataFreshness } from '@/components/dashboard/DataFreshness'

export const Route = createFileRoute('/regulations')({
  head: () => ({
    meta: [{ title: 'Regulations | GovTrace' }],
  }),
  component: RegulationsPage,
})

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// LobbyingLinksPanel — lazy-loaded when a row is expanded
// ──────────────────────────────────────────────────────────────────────────────

function LobbyingLinksPanel({ regulationId }: { regulationId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['gazette-lobby-links', regulationId],
    queryFn: () => getRegulationLobbyingLinks({ data: { regulationId } }),
    staleTime: 1000 * 60 * 10,
  })

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 pb-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  const links = data?.links ?? []

  if (links.length === 0) {
    return (
      <p className="px-4 pb-4 text-sm text-muted-foreground italic">
        No lobbying activity found in the 90-day window before this regulation.
      </p>
    )
  }

  return (
    <div className="px-4 pb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Lobbying Activity (90 days before publication)
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lobbyist</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Client</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Subject</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link, idx) => (
              <tr key={`${link.lobbyistName}-${link.communicationDate}-${String(idx)}`} className="border-t">
                <td className="px-3 py-2">{link.lobbyistName}</td>
                <td className="px-3 py-2 text-muted-foreground">{link.clientName ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(link.communicationDate)}</td>
                <td className="px-3 py-2">
                  {link.subjectMatter ? (
                    <Badge variant="secondary" className="text-xs">{link.subjectMatter}</Badge>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// RegulationRow component
// ──────────────────────────────────────────────────────────────────────────────

function RegulationRowItem({ regulation }: { regulation: RegulationRow }) {
  const [expanded, setExpanded] = useState(false)
  const categories = regulation.lobbyingSubjectCategories ?? []

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start gap-2">
            <span className="font-medium leading-snug">{regulation.title}</span>
            {regulation.sorNumber && (
              <Badge variant="outline" className="shrink-0 font-mono text-xs">
                {regulation.sorNumber}
              </Badge>
            )}
            <a
              href={regulation.gazetteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open ${regulation.title} on Canada Gazette`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {regulation.responsibleDepartment && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {regulation.responsibleDepartment}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(regulation.publicationDate)}
            </span>
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </button>
      {expanded && <LobbyingLinksPanel regulationId={regulation.id} />}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// HeroStats
// ──────────────────────────────────────────────────────────────────────────────

function HeroStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['gazette-stats'],
    queryFn: () => getRegulationStats(),
    staleTime: 1000 * 60 * 60,
  })

  const stats = [
    {
      label: 'Total regulations',
      value: isLoading ? null : String(data?.totalRegulations.toLocaleString() ?? '0'),
      icon: FileText,
    },
    {
      label: 'With lobbying links',
      value: isLoading ? null : String(data?.regulationsWithLobbyLinks.toLocaleString() ?? '0'),
      icon: Search,
    },
    {
      label: 'Departments',
      value: isLoading ? null : String(data?.uniqueDepartments.toLocaleString() ?? '0'),
      icon: Building2,
    },
    {
      label: 'Date range',
      value: isLoading ? null : (
        data?.earliestDate && data?.latestDate
          ? `${formatDate(data.earliestDate)} – ${formatDate(data.latestDate)}`
          : '—'
      ),
      icon: Calendar,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
          {value === null ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <p className="text-lg font-semibold leading-tight">{value}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// RegulationsPage
// ──────────────────────────────────────────────────────────────────────────────

function RegulationsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const PAGE_SIZE = 25

  const { data: departments } = useQuery({
    queryKey: ['gazette-departments'],
    queryFn: () => getDepartmentList(),
    staleTime: 1000 * 60 * 60,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['gazette-regulations', page, search, department],
    queryFn: () =>
      getRegulations({
        data: {
          page,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          department: department || undefined,
        },
      }),
    staleTime: 1000 * 60 * 5,
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = String(formData.get('q') ?? '').trim()
    setSearch(q)
    setPage(1)
  }

  function handleDepartmentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDepartment(e.target.value)
    setPage(1)
  }

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-normal tracking-tight">Canada Gazette Regulations</h1>
        <p className="max-w-2xl text-muted-foreground">
          Final regulations that become Canadian law, published in Part II of the Canada Gazette.
          Expand any regulation to see lobbying activity in the 90 days before it was enacted —
          this is how you trace who may have influenced each law.
        </p>
      </div>

      {/* Stats */}
      <HeroStats />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              type="search"
              placeholder="Search regulations..."
              defaultValue={search}
              className="h-9 rounded-md border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Search regulation titles"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <select
          value={department}
          onChange={handleDepartmentChange}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {(departments ?? []).map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {(search || department) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setDepartment('')
              setPage(1)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total.toLocaleString()} regulations
          {search && ` matching "${search}"`}
          {department && ` from ${department}`}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={String(i)} className="h-16 w-full" />
            ))}
          </div>
        ) : data?.rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            {search || department ? (
              <>
                <p className="text-sm font-medium text-foreground">No regulations match your filters</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try broadening your search or clearing the department filter.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No regulations ingested yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Regulations are pulled from the Canada Gazette Part II. Once the ingestion
                  pipeline runs, they will appear here with lobbying cross-references.
                </p>
              </>
            )}
          </div>
        ) : (
          <div>
            {(data?.rows ?? []).map((regulation) => (
              <RegulationRowItem key={regulation.id} regulation={regulation} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {String(page)} of {String(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Data freshness */}
      <DataFreshness sources={['gazette_regulations', 'lobby_communications']} />

      {/* Source note */}
      <p className="text-xs text-muted-foreground">
        Source:{' '}
        <a
          href="https://gazette.gc.ca/rp-pr/p2/index-eng.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Canada Gazette, Part II
        </a>
        . Lobbying cross-references from the{' '}
        <a
          href="https://lobbycanada.gc.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Office of the Commissioner of Lobbying
        </a>
        . Connections shown do not imply wrongdoing.
      </p>
    </main>
  )
}
