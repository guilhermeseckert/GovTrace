import { Link } from '@tanstack/react-router'
import { ArrowRight, DollarSign, FileText, Gift, Globe, Scale, Users, Landmark, Building2, User } from 'lucide-react'
import { en } from '@/i18n/en'

type EntityResult = {
  id: string
  canonicalName: string
  entityType: string
  province: string | null
  counts: {
    donations: number
    contracts: number
    grants: number
    lobbying: number
    aid: number
    votes: number
  }
}

type SearchResultsProps = { results: EntityResult[] }

function groupByType(results: EntityResult[]) {
  const groups: Record<string, EntityResult[]> = {
    politician: [],
    organization: [],
    person: [],
  }
  for (const r of results) {
    if (r.entityType === 'politician') groups.politician.push(r)
    else if (r.entityType === 'organization' || r.entityType === 'company' || r.entityType === 'department') groups.organization.push(r)
    else groups.person.push(r)
  }
  return groups
}

const GROUP_CONFIG = [
  { key: 'politician', label: 'Politicians & Public Officials', icon: Landmark },
  { key: 'organization', label: 'Companies & Organizations', icon: Building2 },
  { key: 'person', label: 'Individuals', icon: User },
] as const

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="space-y-3 py-16 text-center">
        <h2 className="font-serif text-2xl">{en.search.emptyHeading}</h2>
        <p className="text-muted-foreground">{en.search.emptyBody}</p>
        <p className="text-sm text-muted-foreground/70">{en.search.emptyHint}</p>
      </div>
    )
  }

  const groups = groupByType(results)

  return (
    <div className="space-y-8">
      {GROUP_CONFIG.map(({ key, label, icon: Icon }) => {
        const group = groups[key]
        if (!group || group.length === 0) return null

        return (
          <section key={key}>
            <div className="mb-3 flex items-center gap-2 border-b pb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </h2>
              <span className="tabular-nums ml-auto text-xs text-muted-foreground">{group.length} results</span>
            </div>
            <div className="divide-y">
              {group.map((entity) => (
                <Link
                  key={entity.id}
                  to="/entity/$id"
                  params={{ id: entity.id }}
                  className="group flex items-center gap-4 py-3 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {entity.canonicalName}
                      </span>
                      {entity.province && (
                        <span className="text-xs text-muted-foreground shrink-0">{entity.province}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {entity.counts.donations > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCount(entity.counts.donations)}
                        </span>
                      )}
                      {entity.counts.contracts > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {formatCount(entity.counts.contracts)}
                        </span>
                      )}
                      {entity.counts.grants > 0 && (
                        <span className="flex items-center gap-1">
                          <Gift className="h-3 w-3" />
                          {formatCount(entity.counts.grants)}
                        </span>
                      )}
                      {entity.counts.lobbying > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {formatCount(entity.counts.lobbying)}
                        </span>
                      )}
                      {entity.counts.votes > 0 && (
                        <span className="flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          {formatCount(entity.counts.votes)} votes
                        </span>
                      )}
                      {entity.counts.aid > 0 && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {formatCount(entity.counts.aid)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
