import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// Source: https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b
const CONTRACTS_URL =
  'https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/fac950c0-00d5-4ec1-a4d3-9cbebf98a305/download/contracts.csv'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

/**
 * Downloads the federal contracts CSV from open.canada.ca.
 * Returns the local file path, a SHA-256 hash of the file, and its size.
 * The hash is used for idempotency checking (DATA-07).
 */
export async function downloadContracts(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const response = await fetch(CONTRACTS_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to download contracts CSV: ${response.status} ${response.statusText}`,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const fileHash = createHash('sha256').update(buffer).digest('hex')

  const localPath = join(destDir, 'contracts.csv')
  await writeFile(localPath, buffer)

  return {
    localPath,
    fileHash,
    fileSizeBytes: buffer.length,
  }
}
