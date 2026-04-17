import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ExternalLink, Plane, UtensilsCrossed, Megaphone, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSpendingSummary, getMinisterAnnouncements, getHospitality } from '@/server-fns/datasets'
import { TravelTable } from '@/components/tables/TravelTable'
import { en } from '@/i18n/en'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount === 0) return '$0'
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '—'
  const start = startDate ? String(startDate).slice(0, 10) : null
  const end = endDate ? String(endDate).slice(0, 10) : null
  if (start && end && start !== end) return `${start} – ${end}`
  return start ?? end ?? '—'
}

// ─── stat card ───────────────────────────────────────────────────────────────

type StatCardProps = {
  icon: React.ReactNode
  label: string
  amount: number
  count: number
  countLabel: string
  isLoading: boolean
}

function StatCard({ icon, label, amount, count, countLabel, isLoading }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <span className="text-2xl font-bold tabular-nums">{formatCurrency(amount)}</span>
      )}
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-xs text-muted-foreground">
          {count.toLocaleString()} {countLabel}
        </span>
      )}
    </div>
  )
}

// ─── hospitality table without download button ───────────────────────────────

type HospitalityRow = {
  id: string
  name: string
  titleEn: string | null
  department: string
  departmentCode: string | null
  descriptionEn: string | null
  locationEn: string | null
  vendorEn: string | null
  startDate: string | null
  endDate: string | null
  employeeAttendees: number | null
  guestAttendees: number | null
  total: string
}

type SortableHeaderProps = {
  label: string
  isSorted: false | 'asc' | 'desc'
  onToggle: () => void
}

function SortableHeader({ label, isSorted, onToggle }: SortableHeaderProps) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-1 font-medium">
      {label}
      {isSorted === 'asc' ? (
        <ArrowUp className="h-3 w-3" />
      ) : isSorted === 'desc' ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  )
}

const hospColumns: ColumnDef<HospitalityRow>[] = [
  {
    accessorKey: 'startDate',
    header: ({ column }) => (
      <SortableHeader
        label="Dates"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-sm">
        {formatDateRange(row.original.startDate, row.original.endDate)}
      </span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.name}</span>
        {row.original.titleEn && (
          <p className="max-w-[160px] truncate text-xs text-muted-foreground" title={row.original.titleEn}>
            {row.original.titleEn}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ row }) => (
      <span className="block max-w-[160px] truncate text-sm" title={row.original.department}>
        {row.original.department}
      </span>
    ),
  },
  {
    accessorKey: 'descriptionEn',
    header: 'Description',
    cell: ({ row }) =>
      row.original.descriptionEn ? (
        <span className="block max-w-[180px] truncate text-sm" title={row.original.descriptionEn}>
          {row.original.descriptionEn}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'vendorEn',
    header: 'Vendor',
    cell: ({ row }) =>
      row.original.vendorEn ? (
        <span className="block max-w-[140px] truncate text-sm" title={row.original.vendorEn}>
          {row.original.vendorEn}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'total',
    header: ({ column }) => (
      <SortableHeader
        label="Total"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums font-semibold">
        {formatCurrency(Number(row.original.total))}
      </span>
    ),
  },
]

function HospitalityTableNoDownload({ entityId }: { entityId: string }) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'hospitality-disclosures',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getHospitality({
        data: {
          entityId,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          sortBy,
          sortDir,
        },
      }),
    staleTime: 1000 * 60 * 5,
  })

  const table = useReactTable({
    data: (data?.rows ?? []) as HospitalityRow[],
    columns: hospColumns,
    manualPagination: true,
    manualSorting: true,
    pageCount: data ? Math.ceil(data.total / pagination.pageSize) : 0,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
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

  if (!data?.rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {en.table.empty.replace('{dataset}', 'hospitality disclosures')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {(data.rows as HospitalityRow[]).map((row) => (
          <div key={row.id} className="space-y-1 rounded-md border bg-card p-3 text-sm">
            <div className="flex justify-between font-medium">
              <span className="truncate">{row.name}</span>
              <span className="ml-2 shrink-0 tabular-nums font-semibold">
                {formatCurrency(Number(row.total))}
              </span>
            </div>
            <div className="text-muted-foreground">
              {row.department}
              {row.vendorEn && <> &middot; {row.vendorEn}</>}
            </div>
            {(row.startDate ?? row.endDate) && (
              <div className="text-xs text-muted-foreground">
                {formatDateRange(row.startDate, row.endDate)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{en.table.rowsPerPage}</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(v) =>
              setPagination((p) => ({ ...p, pageSize: Number(v), pageIndex: 0 }))
            }
          >
            <SelectTrigger className="h-8 w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>
            Page {table.getState().pagination.pageIndex + 1} {en.table.of}{' '}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── main SpendingTab component ───────────────────────────────────────────────

export function SpendingTab({ entityId }: { entityId: string }) {
  const [announcementsPage, setAnnouncementsPage] = useState(1)
  const PAGE_SIZE = 10

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['spending-summary', entityId],
    queryFn: () => getSpendingSummary({ data: { entityId } }),
    staleTime: 1000 * 60 * 5,
  })

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ['minister-announcements', entityId, announcementsPage, PAGE_SIZE],
    queryFn: () =>
      getMinisterAnnouncements({
        data: { entityId, page: announcementsPage, pageSize: PAGE_SIZE },
      }),
    staleTime: 1000 * 60 * 5,
  })

  const announcementPageCount = announcements
    ? Math.ceil(announcements.total / PAGE_SIZE)
    : 0

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Plane className="h-4 w-4" />}
          label="Travel Expenses"
          amount={summary?.travelTotal ?? 0}
          count={summary?.travelCount ?? 0}
          countLabel={summary?.travelCount === 1 ? 'trip' : 'trips'}
          isLoading={summaryLoading}
        />
        <StatCard
          icon={<UtensilsCrossed className="h-4 w-4" />}
          label="Hospitality Events"
          amount={summary?.hospitalityTotal ?? 0}
          count={summary?.hospitalityCount ?? 0}
          countLabel={summary?.hospitalityCount === 1 ? 'event' : 'events'}
          isLoading={summaryLoading}
        />
        <StatCard
          icon={<Megaphone className="h-4 w-4" />}
          label="Announced Spending"
          amount={summary?.announcedTotal ?? 0}
          count={summary?.announcementCount ?? 0}
          countLabel={summary?.announcementCount === 1 ? 'announcement' : 'announcements'}
          isLoading={summaryLoading}
        />
      </div>

      {/* Minister announcements section — only shown when data exists */}
      {(announcementsLoading || (announcements?.total ?? 0) > 0) && (
        <section>
          <h3 className="mb-3 text-base font-semibold">Recent Announcements by This Minister</h3>

          {announcementsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {announcements?.rows.map((release) => {
                  const totalDollars = release.dollarAmounts.reduce((acc, da) => {
                    const n = Number(da.amount)
                    return Number.isNaN(n) ? acc : acc + n
                  }, 0)

                  return (
                    <a
                      key={release.id}
                      href={release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between gap-4 rounded-md border bg-card p-4 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 font-medium leading-snug">
                          <span className="line-clamp-2">{release.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{String(release.publishedDate).slice(0, 10)}</span>
                          <span>&middot;</span>
                          <span className="truncate">{release.department}</span>
                        </div>
                      </div>
                      {totalDollars > 0 && (
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {formatCurrency(totalDollars)}
                        </Badge>
                      )}
                    </a>
                  )
                })}
              </div>

              {announcementPageCount > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Page {announcementsPage} of {announcementPageCount}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAnnouncementsPage((p) => Math.max(1, p - 1))}
                      disabled={announcementsPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAnnouncementsPage((p) => Math.min(announcementPageCount, p + 1))
                      }
                      disabled={announcementsPage >= announcementPageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Travel expenses section */}
      <section>
        <h3 className="mb-3 text-base font-semibold">Travel Expenses</h3>
        <TravelTable entityId={entityId} />
      </section>

      {/* Hospitality events section — no download button (available on dedicated tab) */}
      <section>
        <h3 className="mb-3 text-base font-semibold">Hospitality Events</h3>
        <HospitalityTableNoDownload entityId={entityId} />
      </section>
    </div>
  )
}
