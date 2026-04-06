import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { objectsToCsv, downloadCsv } from '@/lib/csv-export'
import { en } from '@/i18n/en'

type CsvColumn = { key: string; header: string }

type DownloadCSVButtonProps = {
  fetchAllRows: () => Promise<Record<string, unknown>[]>
  filename: string
  columns?: CsvColumn[]
  disabled?: boolean
}

export function DownloadCSVButton({
  fetchAllRows,
  filename,
  columns,
  disabled = false,
}: DownloadCSVButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      const rows = await fetchAllRows()
      const csvString = objectsToCsv(rows, columns)
      downloadCsv(csvString, filename)
    } catch (error) {
      console.error('[DownloadCSVButton] Export failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={disabled || isLoading}
      aria-label={isLoading ? en.table.downloading : en.table.downloadCsv}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {isLoading ? en.table.downloading : en.table.downloadCsv}
    </Button>
  )
}
