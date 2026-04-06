import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAppointments } from '@/server-fns/datasets'
import { en } from '@/i18n/en'

type AppointmentRow = {
  id: string
  appointeeName: string
  positionTitle: string
  organizationName: string
  organizationCode: string
  appointmentType: string | null
  tenureType: string | null
  appointmentDate: string | null
  expiryDate: string | null
  isVacant: boolean
  sourceUrl: string
}

function AppointmentTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground">&mdash;</span>
  const isFullTime = type === 'full-time'
  return (
    <Badge variant={isFullTime ? 'default' : 'secondary'} className="text-xs capitalize">
      {type}
    </Badge>
  )
}

function formatDate(raw: string | null): string {
  if (!raw) return '—'
  return String(raw).slice(0, 10)
}

function formatTenureType(raw: string | null): string {
  if (!raw) return '—'
  if (raw === 'during_good_behaviour') return 'Good Behaviour'
  if (raw === 'during_pleasure') return 'At Pleasure'
  return raw
}

type AppointmentsTableProps = {
  entityId: string
}

export function AppointmentsTable({ entityId }: AppointmentsTableProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['appointments', entityId],
    queryFn: () => getAppointments({ data: { entityId } }),
    staleTime: 1000 * 60 * 10,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {en.table.empty.replace('{dataset}', 'GIC appointments')}
      </p>
    )
  }

  const rows = data as AppointmentRow[]

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tenure</TableHead>
              <TableHead>Appointed</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={row.isVacant ? 'opacity-60' : ''}>
                <TableCell>
                  <a
                    href={`https://federal-organizations.canada.ca/profil.php?OrgID=${row.organizationCode}&lang=en`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {row.organizationName}
                  </a>
                </TableCell>
                <TableCell>
                  <span className="max-w-[200px] block truncate text-sm" title={row.positionTitle}>
                    {row.isVacant ? (
                      <span className="text-muted-foreground italic">Vacant</span>
                    ) : (
                      row.positionTitle
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <AppointmentTypeBadge type={row.appointmentType} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatTenureType(row.tenureType)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {formatDate(row.appointmentDate)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {formatDate(row.expiryDate)}
                </TableCell>
                <TableCell>
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>View</span>
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`space-y-1 rounded-md border bg-card p-3 text-sm ${row.isVacant ? 'opacity-60' : ''}`}
          >
            <div className="font-medium">
              <a
                href={`https://federal-organizations.canada.ca/profil.php?OrgID=${row.organizationCode}&lang=en`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {row.organizationName}
              </a>
            </div>
            <div className="text-muted-foreground">
              {row.isVacant ? <span className="italic">Vacant</span> : row.positionTitle}
            </div>
            <div className="flex items-center gap-2">
              <AppointmentTypeBadge type={row.appointmentType} />
              {row.appointmentDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(row.appointmentDate)}
                  {row.expiryDate && <> &ndash; {formatDate(row.expiryDate)}</>}
                </span>
              )}
            </div>
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Source
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
