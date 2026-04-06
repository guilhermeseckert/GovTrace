import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const CSV_URL =
  'https://open.canada.ca/data/dataset/a35cf382-690c-4221-a971-cf0fd189a46f/resource/27e54a33-3c39-42a9-8d58-46dd37c527e5/download/eso_eac_en.csv'

export interface PublicAccountsDownloadResult {
  localPath: string
  fileHash: string
}

/**
 * Downloads the Public Accounts of Canada "Expenditures by Standard Object" CSV
 * directly from open.canada.ca. No ZIP extraction needed — the file is a raw CSV.
 *
 * Returns the local file path and SHA-256 hash of the downloaded content.
 */
export async function downloadPublicAccountsCsv(destDir: string): Promise<PublicAccountsDownloadResult> {
  await mkdir(destDir, { recursive: true })

  console.log(`Downloading Public Accounts CSV from ${CSV_URL}...`)
  const response = await fetch(CSV_URL)
  if (!response.ok) {
    throw new Error(`Failed to download Public Accounts CSV: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  console.log(`Downloaded CSV (${(buffer.length / 1024).toFixed(0)} KB)`)

  const localPath = join(destDir, 'eso_eac_en.csv')
  await writeFile(localPath, buffer)

  const fileHash = createHash('sha256').update(buffer).digest('hex')
  console.log(`Saved to ${localPath}, hash: ${fileHash.slice(0, 8)}...`)

  return { localPath, fileHash }
}
