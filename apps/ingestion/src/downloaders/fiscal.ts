import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import AdmZip from 'adm-zip'

const WDS_URL =
  'https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/10100002/en'

export interface FiscalDownloadResult {
  localPath: string
  fileHash: string
}

/**
 * Downloads the Statistics Canada table 10-10-0002-01 (Central Government Debt)
 * via the WDS REST API, extracts the data CSV from the returned ZIP, and writes
 * it to destDir. Returns the local CSV path and SHA-256 hash of the file.
 */
export async function downloadFiscalCsv(destDir: string): Promise<FiscalDownloadResult> {
  await mkdir(destDir, { recursive: true })

  // Step 1: Fetch WDS envelope to get ZIP URL
  const envelopeRes = await fetch(WDS_URL)
  if (!envelopeRes.ok) {
    throw new Error(`WDS envelope request failed: ${envelopeRes.status} ${envelopeRes.statusText}`)
  }
  const envelope = (await envelopeRes.json()) as { status: string; object: string }
  if (envelope.status !== 'SUCCESS') {
    throw new Error(`WDS returned non-SUCCESS status: ${envelope.status}`)
  }

  // Step 2: Download the ZIP
  console.log(`Downloading StatsCan ZIP from ${envelope.object}...`)
  const zipRes = await fetch(envelope.object)
  if (!zipRes.ok) {
    throw new Error(`Failed to download ZIP: ${zipRes.status} ${zipRes.statusText}`)
  }
  const zipBuffer = Buffer.from(await zipRes.arrayBuffer())
  console.log(`Downloaded ZIP (${(zipBuffer.length / 1024).toFixed(0)} KB)`)

  // Step 3: Extract the data CSV (not the _MetaData CSV)
  const zip = new AdmZip(zipBuffer)
  const dataEntry = zip.getEntries().find(
    (e) => e.entryName.endsWith('-eng.csv') && !e.entryName.includes('_MetaData'),
  )
  if (!dataEntry) {
    throw new Error(`Data CSV not found in StatsCan ZIP. Entries: ${zip.getEntries().map((e) => e.entryName).join(', ')}`)
  }

  const csvData = dataEntry.getData()
  const localPath = join(destDir, '10100002-eng.csv')
  await writeFile(localPath, csvData)

  // Compute SHA-256 hash of the CSV content
  const fileHash = createHash('sha256').update(csvData).digest('hex')
  console.log(`Extracted ${dataEntry.entryName} (${(csvData.length / 1024).toFixed(0)} KB), hash: ${fileHash.slice(0, 8)}...`)

  return { localPath, fileHash }
}
