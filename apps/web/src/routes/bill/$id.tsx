import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { getBillVotes } from '@/server-fns/datasets'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/bill/$id')({
  loader: async ({ params }) => {
    const result = await getBillVotes({ data: { billId: params.id } })
    if (!result.bill) throw notFound()
    return result
  },
  notFoundComponent: () => (
    <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Bill not found</h1>
      <p className="mt-2 text-muted-foreground">
        The bill you are looking for does not exist or has not been ingested yet.
      </p>
    </main>
  ),
  pendingComponent: () => (
    <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-8 space-y-6">
      <div className="h-8 w-64 rounded bg-muted animate-pulse" />
      <div className="h-4 w-full rounded bg-muted animate-pulse" />
      <div className="h-32 rounded-lg border bg-muted animate-pulse" />
    </main>
  ),
  component: BillDetailPage,
})

const BALLOT_CONFIG = {
  Yea: {
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
  Nay: {
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
  Paired: {
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  },
  Abstention: {
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  },
} as const

function getBallotClassName(value: string): string {
  return BALLOT_CONFIG[value as keyof typeof BALLOT_CONFIG]?.className
    ?? 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
}

// Party order for grouped display
const PARTY_ORDER = ['LPC', 'CPC', 'NDP', 'BQ', 'GPC', 'IND']

type Ballot = {
  firstName: string
  lastName: string
  caucusShortName: string | null
  ballotValue: string
  entityId: string | null
}

function groupByParty(ballots: Ballot[]): Map<string, Ballot[]> {
  const grouped = new Map<string, Ballot[]>()

  for (const ballot of ballots) {
    const party = ballot.caucusShortName ?? 'IND'
    const existing = grouped.get(party)
    if (existing) {
      existing.push(ballot)
    } else {
      grouped.set(party, [ballot])
    }
  }

  // Sort by party order
  const sorted = new Map<string, Ballot[]>()
  for (const party of PARTY_ORDER) {
    const members = grouped.get(party)
    if (members) sorted.set(party, members)
  }
  // Add any parties not in PARTY_ORDER
  for (const [party, members] of grouped) {
    if (!sorted.has(party)) sorted.set(party, members)
  }

  return sorted
}

type DivisionCardProps = {
  division: {
    divisionNumber: number
    voteDate: string
    subject: string
    resultName: string
    yeasTotal: number
    naysTotal: number
    parlSessionCode: string
    parliamentNumber: number
    sessionNumber: number
    chamber: string
    ballots: Ballot[]
  }
}

function DivisionCard({ division }: DivisionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const byParty = groupByParty(division.ballots)

  const sourceUrl = division.chamber === 'senate'
    ? `https://sencanada.ca/en/in-the-chamber/votes/details/${division.divisionNumber}/${division.parlSessionCode}`
    : `https://www.ourcommons.ca/members/en/votes/${division.parliamentNumber}/${division.sessionNumber}/${division.divisionNumber}`

  const sourceLabel = division.chamber === 'senate' ? 'sencanada.ca' : 'ourcommons.ca'

  const resultClassName = division.resultName === 'Agreed To' || division.resultName === 'Adopted'
    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
    : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Division summary header */}
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Division {division.divisionNumber} &middot; {String(division.voteDate).slice(0, 10)}
              {division.chamber === 'senate' && (
                <Badge variant="outline" className="ml-2 px-1 py-0 text-[10px]">Senate</Badge>
              )}
            </p>
            <p className="mt-0.5 font-medium">{division.subject}</p>
          </div>
          <Badge className={`text-sm ${resultClassName}`}>
            {division.resultName}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="font-medium">{division.yeasTotal}</span>
            <span className="text-muted-foreground">Yea</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="font-medium">{division.naysTotal}</span>
            <span className="text-muted-foreground">Nay</span>
          </span>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            {sourceLabel}
          </a>
        </div>
      </div>

      {/* Collapsible MP list grouped by party */}
      <div className="border-t">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <span>{division.chamber === 'senate' ? 'Senator' : 'MP'} Votes ({division.ballots.length})</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-4">
            {Array.from(byParty.entries()).map(([party, members]) => (
              <div key={party}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {party} ({members.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div
                      key={`${m.firstName}-${m.lastName}-${m.ballotValue}`}
                      className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {m.entityId ? (
                        <Link
                          to="/entity/$id"
                          params={{ id: m.entityId }}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.firstName} {m.lastName}
                        </Link>
                      ) : (
                        <span className="font-medium">{m.firstName} {m.lastName}</span>
                      )}
                      <Badge className={`text-xs ${getBallotClassName(m.ballotValue)}`}>
                        {m.ballotValue}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BillDetailPage() {
  const { bill, summary, divisions } = Route.useLoaderData()

  if (!bill) return null

  const legisInfoUrl = bill.legisInfoUrl
    ?? `https://www.parl.ca/legisinfo/en/bill/${bill.parliamentNumber}-${bill.sessionNumber}/${bill.billNumberFormatted}`

  return (
    <main id="main-content">
      {/* Hero header */}
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="space-y-1 text-sm text-primary-foreground/70">
            <span>{bill.billTypeEn ?? 'Bill'}</span>
            {bill.parlSessionCode && (
              <>
                <span className="mx-2">&middot;</span>
                <span>{bill.parlSessionCode} Parliament</span>
              </>
            )}
          </div>
          <h1 className="mt-2 font-serif text-3xl text-primary-foreground">
            {bill.billNumberFormatted}: {bill.shortTitleEn ?? bill.longTitleEn ?? 'Untitled Bill'}
          </h1>
          {bill.longTitleEn && bill.shortTitleEn && (
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
              {bill.longTitleEn}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-primary-foreground/80">
            {bill.sponsorEn && (
              <span>
                <span className="font-medium">Sponsor:</span> {bill.sponsorEn}
              </span>
            )}
            {bill.currentStatusEn && (
              <span>
                <span className="mx-2">&middot;</span>
                <span className="font-medium">Status:</span> {bill.currentStatusEn}
              </span>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href={legisInfoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              LEGISinfo
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        {/* AI Summary */}
        {summary ? (
          <div className="rounded-xl border-l-4 border-primary bg-card p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              AI-generated summary
            </p>
            <p className="text-sm leading-relaxed">{summary.summaryText}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Generated by {summary.model} &middot; Summaries do not imply wrongdoing.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border-l-4 border-muted bg-card p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI-generated summary
            </p>
            <p className="text-sm text-muted-foreground">
              Summary being generated&hellip; Check back shortly.
            </p>
          </div>
        )}

        {/* Vote breakdowns */}
        <section>
          <h2 className="mb-5 font-serif text-2xl">
            Vote Breakdowns
            {divisions.length > 0 && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({divisions.length} division{divisions.length !== 1 ? 's' : ''})
              </span>
            )}
          </h2>

          {divisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recorded divisions for this bill yet.
            </p>
          ) : (
            <div className="space-y-4">
              {divisions.map((division) => (
                <DivisionCard key={division.divisionNumber} division={division} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
