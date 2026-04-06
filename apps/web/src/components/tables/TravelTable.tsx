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
import { getTravel } from '@/server-fns/datasets'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'
import { en } from '@/i18n/en'

type TravelRow = {
  id: string
  name: string
  titleEn: string | null
  department: string
  departmentCode: string | null
  purposeEn: string | null
  destinationEn: string | null
  destination2En: string | null
  destinationOtherEn: string | null
  startDate: string | null
  endDate: string | null
  airfare: string | null
  otherTransport: string | null
  lodging: string | null
  meals: string | null
  otherExpenses: string | null
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

const columns: ColumnDef<TravelRow>[] = [
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
      <span className="text-sm max-w-[160px] truncate block" title={row.original.department}>
        {row.original.department}
      </span>
    ),
  },
  {
    accessorKey: 'purposeEn',
    header: 'Purpose',
    cell: ({ row }) =>
      row.original.purposeEn ? (
        <span className="text-sm max-w-[160px] truncate block" title={row.original.purposeEn}>
          {row.original.purposeEn}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'destinationEn',
    header: 'Destination',
    cell: ({ row }) => {
      const primary = row.original.destinationEn
      const secondary = row.original.destination2En ?? row.original.destinationOtherEn
      return primary ? (
        <div>
          <span className="text-sm">{primary}</span>
          {secondary && (
            <p className="text-xs text-muted-foreground" title={secondary}>+more</p>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )
    },
  },
  {
    accessorKey: 'airfare',
    header: 'Airfare',
    cell: ({ row }) => (
      <span className="block text-right tabular-nums text-sm">
        {formatAmount(row.original.airfare)}
      </span>
    ),
  },
  {
    accessorKey: 'lodging',
    header: 'Lodging',
    cell: ({ row }) => (
      <span className="block text-right tabular-nums text-sm">
        {formatAmount(row.original.lodging)}
      </span>
    ),
  },
  {
    accessorKey: 'meals',
    header: 'Meals',
    cell: ({ row }) => (
      <span className="block text-right tabular-nums text-sm">
        {formatAmount(row.original.meals)}
      </span>
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

type TravelTableProps = { entityId: string }

export function TravelTable({ entityId }: TravelTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'travel-disclosures',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getTravel({
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
    data: (data?.rows ?? []) as TravelRow[],
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
        {en.table.empty.replace('{dataset}', 'travel disclosures')}
      </p>
    )
  }

  const travelCsvColumns = [
    { key: 'name', header: 'Name' },
    { key: 'titleEn', header: 'Title' },
    { key: 'department', header: 'Department' },
    { key: 'purposeEn', header: 'Purpose' },
    { key: 'destinationEn', header: 'Destination' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'airfare', header: 'Airfare (CAD)' },
    { key: 'otherTransport', header: 'Other Transport (CAD)' },
    { key: 'lodging', header: 'Lodging (CAD)' },
    { key: 'meals', header: 'Meals (CAD)' },
    { key: 'otherExpenses', header: 'Other Expenses (CAD)' },
    { key: 'total', header: 'Total (CAD)' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DownloadCSVButton
          fetchAllRows={async () => {
            const result = await getTravel({
              data: { entityId, page: 1, pageSize: 10000, sortDir: 'desc' },
            })
            return (result.rows as Record<string, unknown>[]).map(({ id: _, ...rest }) => rest)
          }}
          filename={`govtrace-travel-${entityId.slice(0, 8)}.csv`}
          columns={travelCsvColumns}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-md border md:block">
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
        {(data.rows as TravelRow[]).map((row) => (
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
              {row.department}
              {row.destinationEn && <> &middot; {row.destinationEn}</>}
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
