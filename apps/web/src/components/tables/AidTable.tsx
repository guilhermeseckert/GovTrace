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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getInternationalAid } from '@/server-fns/datasets'
import { en } from '@/i18n/en'

type AidRow = {
  id: string
  projectTitle: string
  description: string | null
  implementerName: string | null
  fundingDepartment: string | null
  activityStatus: number | null
  recipientCountry: string | null
  recipientRegion: string | null
  startDate: string | null
  endDate: string | null
  totalBudgetCad: string | null
  totalDisbursedCad: string | null
  totalCommittedCad: string | null
  currency: string
  rawData: unknown
}

const STATUS_CONFIG = {
  1: { label: 'Pipeline', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  2: { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
  3: { label: 'Finalisation', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' },
  4: { label: 'Closed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400' },
  5: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500' },
} as const

function getStatusConfig(status: number | null) {
  if (status === null) return null
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? null
}

function getSourceUrl(rawData: unknown, id: string): string {
  // Try to construct the Global Affairs Canada project browser URL from the IATI identifier
  // IATI identifiers look like "CA-3-D000123456" — the last segment after the final "-" is the project number
  const segments = id.split('-')
  if (segments.length >= 3) {
    const projectNumber = segments[segments.length - 1]
    if (projectNumber) {
      return `https://w05.international.gc.ca/projectbrowser-banqueprojets/project-projet/details/${projectNumber}`
    }
  }
  // Fallback to open.canada.ca IATI dataset page
  if (rawData && typeof rawData === 'object') {
    const d = rawData as Record<string, unknown>
    const url = d['source_url'] ?? d['sourceUrl'] ?? d['url']
    if (typeof url === 'string' && url.length > 0) return url
  }
  return 'https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad'
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

const columns: ColumnDef<AidRow>[] = [
  {
    accessorKey: 'projectTitle',
    header: 'Project',
    cell: ({ row }) => (
      <span
        className="block max-w-[240px] truncate font-medium"
        title={row.original.projectTitle}
      >
        {row.original.projectTitle}
      </span>
    ),
  },
  {
    accessorKey: 'fundingDepartment',
    header: 'Department',
    cell: ({ row }) =>
      row.original.fundingDepartment ? (
        <span className="max-w-[160px] truncate text-sm">
          {row.original.fundingDepartment}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'recipientCountry',
    header: 'Country',
    cell: ({ row }) =>
      row.original.recipientCountry ?? row.original.recipientRegion ? (
        <span className="text-sm">
          {row.original.recipientCountry ?? row.original.recipientRegion}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'activityStatus',
    header: 'Status',
    cell: ({ row }) => {
      const config = getStatusConfig(row.original.activityStatus)
      return config ? (
        <Badge className={`text-xs ${config.className}`}>{config.label}</Badge>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )
    },
  },
  {
    accessorKey: 'totalDisbursedCad',
    header: ({ column }) => (
      <SortableHeader
        label="Disbursed"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {formatAmount(row.original.totalDisbursedCad)}
      </span>
    ),
  },
  {
    accessorKey: 'totalBudgetCad',
    header: ({ column }) => (
      <SortableHeader
        label="Budget"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {formatAmount(row.original.totalBudgetCad)}
      </span>
    ),
  },
  {
    accessorKey: 'startDate',
    header: ({ column }) => (
      <SortableHeader
        label="Start"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) =>
      row.original.startDate ? (
        <span className="tabular-nums">
          {String(row.original.startDate).slice(0, 10)}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'endDate',
    header: 'End',
    cell: ({ row }) =>
      row.original.endDate ? (
        <span className="tabular-nums">
          {String(row.original.endDate).slice(0, 10)}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    id: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const url = getSourceUrl(row.original.rawData, row.original.id)
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          <span>View</span>
        </a>
      )
    },
  },
]

type AidTableProps = { entityId: string }

export function AidTable({ entityId }: AidTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'international-aid',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getInternationalAid({
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
    data: (data?.rows ?? []) as AidRow[],
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
        {en.table.empty.replace('{dataset}', 'international aid')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
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
        {(data.rows as AidRow[]).map((row) => (
          <div
            key={row.id}
            className="space-y-1 rounded-md border bg-card p-3 text-sm"
          >
            <div className="flex justify-between font-medium">
              <span className="truncate">{row.projectTitle}</span>
              <span className="ml-2 shrink-0 tabular-nums">
                {formatAmount(row.totalDisbursedCad)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {row.fundingDepartment ?? 'Global Affairs Canada'}
              {row.recipientCountry && (
                <> &middot; {row.recipientCountry}</>
              )}
            </div>
            <div className="flex items-center gap-2">
              {row.activityStatus !== null && getStatusConfig(row.activityStatus) && (
                <Badge
                  className={`text-xs ${getStatusConfig(row.activityStatus)?.className ?? ''}`}
                >
                  {getStatusConfig(row.activityStatus)?.label}
                </Badge>
              )}
              {row.startDate && (
                <span className="text-xs text-muted-foreground">
                  {String(row.startDate).slice(0, 10)}
                </span>
              )}
            </div>
            <a
              href={getSourceUrl(row.rawData, row.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Source
            </a>
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
