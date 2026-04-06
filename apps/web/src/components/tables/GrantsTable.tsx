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
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react'
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
import { getGrants } from '@/server-fns/datasets'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'
import { en } from '@/i18n/en'

type GrantRow = {
  id: string
  recipientName: string
  recipientLegalName: string | null
  department: string
  programName: string | null
  description: string | null
  amount: string | null
  agreementDate: string | null
  startDate: string | null
  endDate: string | null
  province: string | null
  city: string | null
  grantType: string | null
  rawData: unknown
}

function getSourceUrl(rawData: unknown): string | null {
  if (!rawData || typeof rawData !== 'object') return null
  const d = rawData as Record<string, unknown>
  const url = d['source_url'] ?? d['sourceUrl'] ?? d['url']
  if (typeof url === 'string' && url.length > 0) return url
  // Fallback: open.canada.ca grants dataset
  return null
}

function formatAmount(amount: string | null): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(n)
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

const columns: ColumnDef<GrantRow>[] = [
  {
    accessorKey: 'recipientName',
    header: 'Recipient',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.recipientName}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <SortableHeader
        label="Value"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {formatAmount(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ row }) => (
      <span className="max-w-[180px] truncate text-sm">
        {row.original.department}
      </span>
    ),
  },
  {
    accessorKey: 'agreementDate',
    header: ({ column }) => (
      <SortableHeader
        label="Date"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) =>
      row.original.agreementDate ? (
        <span className="tabular-nums">
          {String(row.original.agreementDate).slice(0, 10)}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'programName',
    header: 'Program',
    cell: ({ row }) =>
      row.original.programName ? (
        <span
          className="max-w-[200px] truncate text-sm"
          title={row.original.programName}
        >
          {row.original.programName}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    id: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const url = getSourceUrl(row.original.rawData)
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          <span>View</span>
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">&mdash;</span>
      )
    },
  },
]

type GrantsTableProps = { entityId: string }

export function GrantsTable({ entityId }: GrantsTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'grants',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getGrants({
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
    data: (data?.rows ?? []) as GrantRow[],
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
        {en.table.empty.replace('{dataset}', 'grant')}
      </p>
    )
  }

  const grantCsvColumns = [
    { key: 'recipientName', header: 'Recipient Name' },
    { key: 'recipientLegalName', header: 'Recipient Legal Name' },
    { key: 'amount', header: 'Amount (CAD)' },
    { key: 'department', header: 'Department' },
    { key: 'programName', header: 'Program Name' },
    { key: 'description', header: 'Description' },
    { key: 'agreementDate', header: 'Agreement Date' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'province', header: 'Province' },
    { key: 'city', header: 'City' },
    { key: 'grantType', header: 'Grant Type' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DownloadCSVButton
          fetchAllRows={async () => {
            const result = await getGrants({
              data: { entityId, page: 1, pageSize: 10000, sortDir: 'desc' },
            })
            return (result.rows as Record<string, unknown>[]).map(({ rawData: _, id: __, ...rest }) => rest)
          }}
          filename={`govtrace-grants-${entityId.slice(0, 8)}.csv`}
          columns={grantCsvColumns}
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

      {/* Mobile card view (DSGN-03) */}
      <div className="space-y-3 md:hidden">
        {(data.rows as GrantRow[]).map((row) => (
          <div
            key={row.id}
            className="space-y-1 rounded-md border bg-card p-3 text-sm"
          >
            <div className="flex justify-between font-medium">
              <span className="truncate">{row.recipientName}</span>
              <span className="ml-2 shrink-0 tabular-nums">
                {formatAmount(row.amount)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {row.department}
              {row.agreementDate && (
                <> &middot; {String(row.agreementDate).slice(0, 10)}</>
              )}
            </div>
            {row.programName && (
              <p className="truncate text-xs text-muted-foreground">
                {row.programName}
              </p>
            )}
            {getSourceUrl(row.rawData) && (
              <a
                href={getSourceUrl(row.rawData) ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Source
              </a>
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
