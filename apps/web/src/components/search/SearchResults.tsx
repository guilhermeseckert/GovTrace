import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { en } from '@/i18n/en'

type EntityResult = {
  id: string
  canonicalName: string
  entityType: string
  province: string | null
  counts: { donations: number; contracts: number; grants: number; lobbying: number }
}

type SearchResultsProps = { results: EntityResult[] }

function groupByType(results: EntityResult[]) {
  const groups: Record<string, EntityResult[]> = {
    politician: [],
    company: [],
    organization: [],
    person: [],
    other: [],
  }
  for (const r of results) {
    const key =
      r.entityType === 'department'
        ? 'other'
        : groups[r.entityType]
          ? r.entityType
          : 'other'
    groups[key].push(r)
  }
  return groups
}

const GROUP_LABELS: Record<string, string> = {
  politician: 'Politicians',
  company: 'Companies / Organizations',
  organization: 'Companies / Organizations',
  person: 'People',
  other: 'Other',
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="space-y-2 py-12 text-center">
        <h2 className="text-xl font-semibold">{en.search.emptyHeading}</h2>
        <p className="text-muted-foreground">{en.search.emptyBody}</p>
        <p className="text-sm text-muted-foreground">{en.search.emptyHint}</p>
      </div>
    )
  }

  const groups = groupByType(results)
  const orderedKeys = ['politician', 'company', 'person', 'other']
  const seenLabels = new Set<string>()

  return (
    <div className="space-y-8">
      {orderedKeys.map((key) => {
        const group = groups[key]
        if (!group || group.length === 0) return null
        const label = GROUP_LABELS[key]
        if (seenLabels.has(label)) return null
        seenLabels.add(label)

        return (
          <section key={key}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-xl font-semibold">{label}</h2>
              <Badge variant="secondary">{group.length}</Badge>
            </div>
            <div className="space-y-2">
              {group.map((entity) => (
                <Card key={entity.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Link
                        to="/entity/$id"
                        params={{ id: entity.id }}
                        className="font-semibold text-base hover:text-primary transition-colors"
                      >
                        {entity.canonicalName}
                      </Link>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        {entity.counts.donations > 0 && (
                          <span>💰 {entity.counts.donations} donations</span>
                        )}
                        {entity.counts.contracts > 0 && (
                          <span>📄 {entity.counts.contracts} contracts</span>
                        )}
                        {entity.counts.lobbying > 0 && (
                          <span>🤝 {entity.counts.lobbying} lobbying</span>
                        )}
                        {entity.counts.grants > 0 && (
                          <span>💵 {entity.counts.grants} grants</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {entity.entityType}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
