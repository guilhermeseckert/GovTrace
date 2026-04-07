import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import { Link } from '@tanstack/react-router'
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
import { getVotingRecord } from '@/server-fns/datasets'
import { DownloadCSVButton } from '@/components/tables/DownloadCSVButton'

type VoteRow = {
  voteDate: string
  subject: string
  billNumber: string | null
  billId: string | null
  ballotValue: string
  resultName: string
  shortTitleEn: string | null
  divisionNumber: number
  parlSessionCode: string
  parliamentNumber: number
  sessionNumber: number
  chamber: string
}

const BALLOT_CONFIG = {
  Yea: {
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    label: 'Yea',
  },
  Nay: {
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    label: 'Nay',
  },
  Paired: {
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
    label: 'Paired',
  },
  Abstention: {
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    label: 'Abstention',
  },
} as const

function getBallotConfig(value: string) {
  return BALLOT_CONFIG[value as keyof typeof BALLOT_CONFIG] ?? {
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
    label: value,
  }
}

function getVoteSourceUrl(row: VoteRow): string {
  if (row.chamber === 'senate') {
    return `https://sencanada.ca/en/in-the-chamber/votes/details/${row.divisionNumber}/${row.parlSessionCode}`
  }
  return `https://www.ourcommons.ca/members/en/votes/${row.parliamentNumber}/${row.sessionNumber}/${row.divisionNumber}`
}

const columns: ColumnDef<VoteRow>[] = [
  {
    accessorKey: 'voteDate',
    header: 'Date',
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {String(row.original.voteDate).slice(0, 10)}
      </span>
    ),
  },
  {
    accessorKey: 'subject',
    header: 'Bill / Motion',
    cell: ({ row }) => {
      const { billId, billNumber, shortTitleEn, subject } = row.original
      const label = shortTitleEn
        ? `${billNumber ?? ''} — ${shortTitleEn}`
        : (billNumber ? `${billNumber} — ${subject}` : subject)

      if (billId) {
        return (
          <Link
            to="/bill/$id"
            params={{ id: billId }}
            className="block max-w-[300px] truncate text-sm font-medium text-primary hover:underline"
            title={label}
          >
            {label}
          </Link>
        )
      }

      return (
        <span
          className="block max-w-[300px] truncate text-sm"
          title={subject}
        >
          {subject}
        </span>
      )
    },
  },
  {
    accessorKey: 'ballotValue',
    header: 'Vote',
    cell: ({ row }) => {
      const config = getBallotConfig(row.original.ballotValue)
      return (
        <Badge className={`text-xs ${config.className}`}>
          {config.label}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'resultName',
    header: 'Result',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.resultName}
      </span>
    ),
  },
  {
    accessorKey: 'parlSessionCode',
    header: 'Parliament',
    cell: ({ row }) => (
      <span className="flex items-center gap-1">
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original.parlSessionCode}
        </span>
        {row.original.chamber === 'senate' && (
          <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">Senate</Badge>
        )}
      </span>
    ),
  },
  {
    id: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const url = getVoteSourceUrl(row.original)
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

type VotesTableProps = { entityId: string }

export function VotesTable({ entityId }: VotesTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['voting-record', entityId, pagination.pageIndex],
    queryFn: () =>
      getVotingRecord({
        data: {
          entityId,
          page: pagination.pageIndex + 1,
        },
      }),
    staleTime: 1000 * 60 * 5,
  })

  const table = useReactTable({
    data: (data?.rows ?? []) as VoteRow[],
    columns,
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / 25) : 0,
    state: { pagination },
    onPaginationChange: setPagination,
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
        No voting records found for this entity.
      </p>
    )
  }

  const rows = data.rows as VoteRow[]

  const votesCsvColumns = [
    { key: 'voteDate', header: 'Vote Date' },
    { key: 'billNumber', header: 'Bill Number' },
    { key: 'subject', header: 'Subject' },
    { key: 'shortTitleEn', header: 'Bill Title' },
    { key: 'ballotValue', header: 'Vote' },
    { key: 'resultName', header: 'Result' },
    { key: 'parlSessionCode', header: 'Parliament Session' },
    { key: 'parliamentNumber', header: 'Parliament Number' },
    { key: 'sessionNumber', header: 'Session Number' },
    { key: 'divisionNumber', header: 'Division Number' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DownloadCSVButton
          fetchAllRows={async () => {
            const result = await getVotingRecord({
              data: { entityId, page: 1, pageSize: 10000 },
            })
            return result.rows as Record<string, unknown>[]
          }}
          filename={`govtrace-votes-${entityId.slice(0, 8)}.csv`}
          columns={votesCsvColumns}
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
        {rows.map((row) => {
          const ballotConfig = getBallotConfig(row.ballotValue)
          const billLabel = row.shortTitleEn
            ? `${row.billNumber ?? ''} — ${row.shortTitleEn}`
            : (row.billNumber ? `${row.billNumber} — ${row.subject}` : row.subject)
          const sourceUrl = getVoteSourceUrl(row)

          return (
            <div
              key={`${row.parlSessionCode}-${row.divisionNumber}`}
              className="space-y-1 rounded-md border bg-card p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {row.billId ? (
                    <Link
                      to="/bill/$id"
                      params={{ id: row.billId }}
                      className="block truncate font-medium text-primary hover:underline"
                      title={billLabel}
                    >
                      {billLabel}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium" title={row.subject}>
                      {row.subject}
                    </span>
                  )}
                </div>
                <Badge className={`shrink-0 text-xs ${ballotConfig.className}`}>
                  {ballotConfig.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="tabular-nums">{String(row.voteDate).slice(0, 10)}</span>
                <span>&middot;</span>
                <span>{row.resultName}</span>
                <span>&middot;</span>
                <span>{row.parlSessionCode}</span>
                {row.chamber === 'senate' && (
                  <Badge variant="outline" className="px-1 py-0 text-[10px]">Senate</Badge>
                )}
              </div>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Source
              </a>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {data.total.toLocaleString()} total votes
        </span>
        <div className="flex items-center gap-2 text-sm">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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
