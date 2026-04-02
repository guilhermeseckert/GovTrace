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
import { ArrowUpDown, ExternalLink } from 'lucide-react'
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
import { getLobbying } from '@/server-fns/datasets'
import { en } from '@/i18n/en'

// Unified row shape for display — merges registrations and communications
type LobbyRow = {
  id: string
  type: 'registration' | 'communication'
  registrantName: string
  subjectMatter: string | null
  date: string | null
  officialName: string | null
  department: string | null
  rawData: unknown
}

function getSourceUrl(rawData: unknown): string | null {
  if (!rawData || typeof rawData !== 'object') return null
  const d = rawData as Record<string, unknown>
  const url = d['source_url'] ?? d['sourceUrl'] ?? d['url']
  if (typeof url === 'string' && url.length > 0) return url
  // Fallback: lobbycanada.gc.ca search
  const regNum = d['registration_number'] ?? d['registrationNumber']
  if (typeof regNum === 'string' && regNum.length > 0) {
    return `https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/vwRg?cno=${regNum}`
  }
  return null
}

const columns: ColumnDef<LobbyRow>[] = [
  {
    accessorKey: 'registrantName',
    header: 'Registrant',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.registrantName}</span>
    ),
  },
  {
    accessorKey: 'subjectMatter',
    header: 'Subject Matter',
    cell: ({ row }) =>
      row.original.subjectMatter ? (
        <span
          className="max-w-[220px] truncate text-sm"
          title={row.original.subjectMatter}
        >
          {row.original.subjectMatter}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <button
        type="button"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center gap-1 font-medium"
      >
        Date
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </button>
    ),
    cell: ({ row }) =>
      row.original.date ? (
        <span className="tabular-nums">
          {String(row.original.date).slice(0, 10)}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'officialName',
    header: 'Official',
    cell: ({ row }) =>
      row.original.officialName ? (
        <span className="text-sm">{row.original.officialName}</span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ row }) =>
      row.original.department ? (
        <span
          className="max-w-[160px] truncate text-sm"
          title={row.original.department}
        >
          {row.original.department}
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

type LobbyingTableProps = { entityId: string }

export function LobbyingTable({ entityId }: LobbyingTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'lobbying',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getLobbying({
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

  // Merge registrations + communications into unified display rows
  const allRows: LobbyRow[] = data
    ? [
        ...(data.rows.registrations.map((r) => ({
          id: r.id,
          type: 'registration' as const,
          registrantName: r.lobbyistName,
          subjectMatter: r.subjectMatter,
          date: r.registrationDate,
          officialName: null,
          department: null,
          rawData: r.rawData,
        }))),
        ...(data.rows.communications.map((c) => ({
          id: c.id,
          type: 'communication' as const,
          registrantName: c.lobbyistName,
          subjectMatter: c.subjectMatter,
          date: c.communicationDate,
          officialName: c.publicOfficialName,
          department: c.department ?? null,
          rawData: c.rawData,
        }))),
      ]
    : []

  const table = useReactTable({
    data: allRows,
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

  if (!allRows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {en.table.empty.replace('{dataset}', 'lobbying')}
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

      {/* Mobile card view (DSGN-03) */}
      <div className="space-y-3 md:hidden">
        {allRows.map((row) => (
          <div
            key={row.id}
            className="space-y-1 rounded-md border bg-card p-3 text-sm"
          >
            <div className="font-medium">{row.registrantName}</div>
            {row.subjectMatter && (
              <div className="truncate text-muted-foreground">
                {row.subjectMatter}
              </div>
            )}
            <div className="text-muted-foreground">
              {row.date && <span className="tabular-nums">{String(row.date).slice(0, 10)}</span>}
              {row.officialName && <> &middot; {row.officialName}</>}
            </div>
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
