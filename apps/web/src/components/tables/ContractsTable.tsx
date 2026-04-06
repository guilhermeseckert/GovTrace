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
import { getContracts } from '@/server-fns/datasets'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'
import { en } from '@/i18n/en'

type ContractRow = {
  id: string
  contractId: string | null
  vendorName: string
  department: string
  description: string | null
  value: string | null
  originalValue: string | null
  awardDate: string | null
  startDate: string | null
  endDate: string | null
  procurementMethod: string | null
  province: string | null
  rawData: unknown
}

function getSourceUrl(rawData: unknown, contractId: string | null): string | null {
  if (rawData && typeof rawData === 'object') {
    const d = rawData as Record<string, unknown>
    const url = d['source_url'] ?? d['sourceUrl'] ?? d['proactive_disclosure_url'] ?? d['url']
    if (typeof url === 'string' && url.length > 0) return url
    // Construct buyandsell.gc.ca URL from contract ID if available
    const govContractId = d['contract_id'] ?? d['contractId']
    if (typeof govContractId === 'string' && govContractId.length > 0) {
      return `https://buyandsell.gc.ca/procurement-data/contract-history/${govContractId}`
    }
  }
  if (contractId) {
    return `https://buyandsell.gc.ca/procurement-data/contract-history/${contractId}`
  }
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

const columns: ColumnDef<ContractRow>[] = [
  {
    accessorKey: 'vendorName',
    header: 'Vendor',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.vendorName}</span>
    ),
  },
  {
    accessorKey: 'value',
    header: ({ column }) => (
      <SortableHeader
        label="Value"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {formatAmount(row.original.value)}
      </span>
    ),
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate text-sm">
        {row.original.department}
      </span>
    ),
  },
  {
    accessorKey: 'awardDate',
    header: ({ column }) => (
      <SortableHeader
        label="Award Date"
        isSorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) =>
      row.original.awardDate ? (
        <span className="tabular-nums">
          {String(row.original.awardDate).slice(0, 10)}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) =>
      row.original.description ? (
        <span
          className="max-w-[220px] truncate text-sm"
          title={row.original.description}
        >
          {row.original.description}
        </span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      ),
  },
  {
    id: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const url = getSourceUrl(row.original.rawData, row.original.contractId)
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

type ContractsTableProps = { entityId: string }

export function ContractsTable({ entityId }: ContractsTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const sortBy = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? ('desc' as const) : ('asc' as const)

  const { data, isLoading } = useQuery({
    queryKey: [
      'contracts',
      entityId,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDir,
    ],
    queryFn: () =>
      getContracts({
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
    data: (data?.rows ?? []) as ContractRow[],
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
        {en.table.empty.replace('{dataset}', 'contract')}
      </p>
    )
  }

  const contractCsvColumns = [
    { key: 'vendorName', header: 'Vendor Name' },
    { key: 'value', header: 'Contract Value (CAD)' },
    { key: 'originalValue', header: 'Original Value (CAD)' },
    { key: 'department', header: 'Department' },
    { key: 'description', header: 'Description' },
    { key: 'awardDate', header: 'Award Date' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'procurementMethod', header: 'Procurement Method' },
    { key: 'province', header: 'Province' },
    { key: 'contractId', header: 'Contract ID' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DownloadCSVButton
          fetchAllRows={async () => {
            const result = await getContracts({
              data: { entityId, page: 1, pageSize: 10000, sortDir: 'desc' },
            })
            return (result.rows as Record<string, unknown>[]).map(({ rawData: _, id: __, ...rest }) => rest)
          }}
          filename={`govtrace-contracts-${entityId.slice(0, 8)}.csv`}
          columns={contractCsvColumns}
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
        {(data.rows as ContractRow[]).map((row) => (
          <div
            key={row.id}
            className="space-y-1 rounded-md border bg-card p-3 text-sm"
          >
            <div className="flex justify-between font-medium">
              <span className="truncate">{row.vendorName}</span>
              <span className="ml-2 shrink-0 tabular-nums">
                {formatAmount(row.value)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {row.department}
              {row.awardDate && (
                <> &middot; {String(row.awardDate).slice(0, 10)}</>
              )}
            </div>
            {row.description && (
              <p className="truncate text-xs text-muted-foreground">
                {row.description}
              </p>
            )}
            {getSourceUrl(row.rawData, row.contractId) && (
              <a
                href={getSourceUrl(row.rawData, row.contractId) ?? '#'}
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
