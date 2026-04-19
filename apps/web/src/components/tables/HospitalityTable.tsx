import { getDepartmentName } from '@/lib/department-codes'
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
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getHospitality } from '@/server-fns/datasets'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'
import { en } from '@/i18n/en'

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

function formatAmount(amount: string | null): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '—'
  const start = startDate ? String(startDate).slice(0, 10) : null
  const end = endDate ? String(endDate).slice(0, 10) : null
  if (start && end && start !== end) return `${start} – ${end}`
  return start ?? end ?? '—'
}

type SortableHeaderProps = {
  label: string
  isSorted: false | 'asc' | 'desc'
  onToggle: () => void
}

function SortableHeader({ label, isSorted, onToggle }: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 font-medium"
    >
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

const columns: ColumnDef<HospitalityRow>[] = [
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
          <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={row.original.titleEn}>
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
      <span className="text-sm max-w-[160px] truncate block" title={getDepartmentName(row.original.department)}>
        {getDepartmentName(row.original.department)}
      </span>
    ),
  },
  {
    accessorKey: 'descriptionEn',
    header: 'Description',
    cell: ({ row }) =>
      row.original.descriptionEn ? (
        <span className="text-sm max-w-[180px] truncate block" title={row.original.descriptionEn}>
          {row.original.descriptionEn}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'locationEn',
    header: 'Location',
    cell: ({ row }) =>
      row.original.locationEn ? (
        <span className="text-sm">{row.original.locationEn}</span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'vendorEn',
    header: 'Vendor',
    cell: ({ row }) =>
      row.original.vendorEn ? (
        <span className="text-sm max-w-[140px] truncate block" title={row.original.vendorEn}>
          {row.original.vendorEn}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'employeeAttendees',
    header: 'Employees',
    cell: ({ row }) =>
      row.original.employeeAttendees !== null ? (
        <span className="block text-right tabular-nums text-sm">
          {row.original.employeeAttendees}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'guestAttendees',
    header: 'Guests',
    cell: ({ row }) =>
      row.original.guestAttendees !== null ? (
        <span className="block text-right tabular-nums text-sm">
          {row.original.guestAttendees}
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
        {formatAmount(row.original.total)}
      </span>
    ),
  },
]

type HospitalityTableProps = { entityId: string }

export function HospitalityTable({ entityId }: HospitalityTableProps) {
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
    columns,
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

  const hospitalityCsvColumns = [
    { key: 'name', header: 'Name' },
    { key: 'titleEn', header: 'Title' },
    { key: 'department', header: 'Department' },
    { key: 'descriptionEn', header: 'Description' },
    { key: 'locationEn', header: 'Location' },
    { key: 'vendorEn', header: 'Vendor' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'employeeAttendees', header: 'Employee Attendees' },
    { key: 'guestAttendees', header: 'Guest Attendees' },
    { key: 'total', header: 'Total (CAD)' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DownloadCSVButton
          fetchAllRows={async () => {
            const result = await getHospitality({
              data: { entityId, page: 1, pageSize: 10000, sortDir: 'desc' },
            })
            return (result.rows as Record<string, unknown>[]).map(({ id: _, ...rest }) => rest)
          }}
          filename={`govtrace-hospitality-${entityId.slice(0, 8)}.csv`}
          columns={hospitalityCsvColumns}
        />
      </div>

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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
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
          <div
            key={row.id}
            className="space-y-1 rounded-md border bg-card p-3 text-sm"
          >
            <div className="flex justify-between font-medium">
              <span className="truncate">{row.name}</span>
              <span className="ml-2 shrink-0 tabular-nums font-semibold">
                {formatAmount(row.total)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {getDepartmentName(row.department)}
              {row.vendorEn && <> &middot; {row.vendorEn}</>}
            </div>
            {(row.startDate ?? row.endDate) && (
              <div className="text-xs text-muted-foreground">
                {formatDateRange(row.startDate, row.endDate)}
              </div>
            )}
            {(row.employeeAttendees !== null || row.guestAttendees !== null) && (
              <div className="text-xs text-muted-foreground">
                {row.employeeAttendees !== null && <>{row.employeeAttendees} employees</>}
                {row.employeeAttendees !== null && row.guestAttendees !== null && <>, </>}
                {row.guestAttendees !== null && <>{row.guestAttendees} guests</>}
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
              setPagination((p) => ({
                ...p,
                pageSize: Number(v),
                pageIndex: 0,
              }))
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
