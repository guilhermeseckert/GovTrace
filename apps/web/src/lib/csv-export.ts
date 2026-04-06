// Keys excluded from CSV exports by default — internal/UI-only fields
const DEFAULT_EXCLUDED_KEYS = new Set(['rawData', 'id'])

type CsvColumn = { key: string; header: string }

/**
 * Converts an array of objects to a RFC 4180-compliant CSV string.
 * Prefixes with BOM for Excel/Numbers compatibility with French characters.
 *
 * @param rows - Array of objects to convert
 * @param columns - Optional column definitions controlling key selection and header labels.
 *   If omitted, all keys from the first row are used (excluding DEFAULT_EXCLUDED_KEYS).
 */
export function objectsToCsv(
  rows: Record<string, unknown>[],
  columns?: CsvColumn[],
): string {
  if (rows.length === 0) return '\uFEFF'

  const cols: CsvColumn[] = columns
    ? columns
    : Object.keys(rows[0]).filter((k) => !DEFAULT_EXCLUDED_KEYS.has(k)).map((k) => ({
        key: k,
        header: k,
      }))

  const escapeCell = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value)
    // Wrap in quotes if contains comma, quote, newline or carriage return
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replaceAll('"', '""')}"`
    }
    return str
  }

  const headerRow = cols.map((c) => escapeCell(c.header)).join(',')
  const dataRows = rows.map((row) =>
    cols.map((c) => escapeCell(row[c.key])).join(','),
  )

  return `\uFEFF${[headerRow, ...dataRows].join('\r\n')}`
}

/**
 * Triggers a browser download of the given CSV string as a .csv file.
 */
export function downloadCsv(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
