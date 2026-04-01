import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import AdmZip from 'adm-zip'

// Source: https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip
const ELECTIONS_CANADA_URL = 'https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

/**
 * Downloads the Elections Canada contributions ZIP and extracts CSV files.
 * Returns the path to the extracted CSV file, SHA-256 hash of the ZIP, and file size.
 * The hash is used for idempotency checking (DATA-07).
 */
export async function downloadElectionsCanada(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const response = await fetch(ELECTIONS_CANADA_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to download Elections Canada ZIP: ${response.status} ${response.statusText}`,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const zipPath = join(destDir, 'od_cntrbtn_audt_e.zip')

  // Write ZIP to disk
  await writeFile(zipPath, buffer)

  // Hash the ZIP for idempotency check (DATA-07)
  const fileHash = createHash('sha256').update(buffer).digest('hex')

  // Extract CSV from ZIP using adm-zip
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter((e) => e.entryName.endsWith('.csv'))

  if (entries.length === 0) {
    throw new Error('No CSV file found in Elections Canada ZIP')
  }

  const firstEntry = entries[0]
  if (!firstEntry) {
    throw new Error('No CSV file found in Elections Canada ZIP')
  }

  zip.extractEntryTo(firstEntry.entryName, destDir, false, true)
  const csvPath = join(destDir, firstEntry.entryName)

  return {
    localPath: csvPath,
    fileHash,
    fileSizeBytes: buffer.length,
  }
}
