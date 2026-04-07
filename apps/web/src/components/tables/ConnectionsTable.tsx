import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ExternalLink } from 'lucide-react'
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
import { getConnections } from '@/server-fns/datasets'
import { CONNECTION_LABELS, formatAmount } from '@/lib/connection-labels'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'
import { en } from '@/i18n/en'

type ConnectionRow = {
  id: string
  connectedEntityId: string
  connectionType: string
  totalValue: string | null
  transactionCount: number
  firstSeen: string | null
  lastSeen: string | null
  sourceTable: string
  connectedEntityName: string | null
  connectedEntityType: string | null
}

function formatDateRange(
  firstSeen: string | null,
  lastSeen: string | null,
): string {
  if (!firstSeen) return '—'
  const first = String(firstSeen).slice(0, 10)
  if (!lastSeen) return first
  const last = String(lastSeen).slice(0, 10)
  return first === last ? first : `${first} – ${last}`
}

const columns: ColumnDef<ConnectionRow>[] = [
  {
    accessorKey: 'connectedEntityName',
    header: 'Entity',
    cell: ({ row }) => {
      const name =
        row.original.connectedEntityName ?? row.original.connectedEntityId
      return (
        <Link
          to="/entity/$id"
          params={{ id: row.original.connectedEntityId }}
          className="font-medium hover:underline"
        >
          {name}
        </Link>
      )
    },
  },
  {
    accessorKey: 'connectionType',
    header: 'Relationship',
    cell: ({ row }) => {
      const cfg = CONNECTION_LABELS[row.original.connectionType]
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg?.color ?? 'bg-muted text-muted-foreground'}`}>
          {cfg?.label ?? row.original.connectionType.replaceAll('_', ' ')}
        </span>
      )
    },
  },
  {
    accessorKey: 'totalValue',
    header: ({ column }) => (
      <button
        type="button"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center gap-1 font-medium"
      >
        Total Value
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </button>
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {formatAmount(row.original.totalValue)}
      </span>
    ),
  },
  {
    accessorKey: 'transactionCount',
    header: 'Transactions',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.transactionCount}</span>
    ),
  },
  {
    id: 'dateRange',
    header: 'Period',
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {formatDateRange(row.original.firstSeen, row.original.lastSeen)}
      </span>
    ),
  },
  {
    id: 'viewEntity',
    header: '',
    cell: ({ row }) => (
      <Link
        to="/entity/$id"
        params={{ id: row.original.connectedEntityId }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label={`View entity ${row.original.connectedEntityName ?? row.original.connectedEntityId}`}
      >
        <ExternalLink className="h-3 w-3" />
      </Link>
    ),
  },
]

type ConnectionsTableProps = { entityId: string }

export function ConnectionsTable({ entityId }: ConnectionsTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'connections',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getConnections({
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
    data: (data?.rows ?? []) as ConnectionRow[],
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
        {en.table.empty.replace('{dataset}', 'connections')}
      </p>
    )
  }

  const connectionsCsvColumns = [
    { key: 'connectedEntityName', header: 'Connected Entity' },
    { key: 'connectedEntityType', header: 'Entity Type' },
    { key: 'connectionType', header: 'Relationship' },
    { key: 'totalValue', header: 'Total Value (CAD)' },
    { key: 'transactionCount', header: 'Transaction Count' },
    { key: 'firstSeen', header: 'First Seen' },
    { key: 'lastSeen', header: 'Last Seen' },
    { key: 'sourceTable', header: 'Source Dataset' },
    { key: 'connectedEntityId', header: 'Entity ID' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DownloadCSVButton
          fetchAllRows={async () => {
            const result = await getConnections({
              data: { entityId, page: 1, pageSize: 10000, sortDir: 'desc' },
            })
            return (result.rows as Record<string, unknown>[]).map(({ id: _, ...rest }) => rest)
          }}
          filename={`govtrace-connections-${entityId.slice(0, 8)}.csv`}
          columns={connectionsCsvColumns}
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

      {/* Mobile card view (DSGN-03) */}
      <div className="space-y-3 md:hidden">
        {(data.rows as ConnectionRow[]).map((row) => (
          <div
            key={row.id}
            className="space-y-1 rounded-md border bg-card p-3 text-sm"
          >
            <div className="flex items-start justify-between">
              <Link
                to="/entity/$id"
                params={{ id: row.connectedEntityId }}
                className="font-medium hover:underline"
              >
                {row.connectedEntityName ?? row.connectedEntityId}
              </Link>
              <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                {row.connectionType}
              </Badge>
            </div>
            <div className="text-muted-foreground">
              <span className="tabular-nums">{formatAmount(row.totalValue)}</span>
              {' '}&middot; {row.transactionCount} transaction{row.transactionCount !== 1 ? 's' : ''}
            </div>
            <div className="tabular-nums text-xs text-muted-foreground">
              {formatDateRange(row.firstSeen, row.lastSeen)}
            </div>
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
