import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// Source: https://open.canada.ca/data/dataset/432527ab-7aac-45b5-81d6-7597107a7013
const GRANTS_URL =
  'https://open.canada.ca/data/dataset/432527ab-7aac-45b5-81d6-7597107a7013/resource/1d15a62f-5656-49ad-8c88-f40ce689d831/download/grants.csv'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

/**
 * Downloads the federal grants CSV from open.canada.ca.
 * Returns the local file path, a SHA-256 hash of the file, and its size.
 * The hash is used for idempotency checking (DATA-07).
 */
export async function downloadGrants(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const response = await fetch(GRANTS_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to download grants CSV: ${response.status} ${response.statusText}`,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const fileHash = createHash('sha256').update(buffer).digest('hex')

  const localPath = join(destDir, 'grants.csv')
  await writeFile(localPath, buffer)

  return {
    localPath,
    fileHash,
    fileSizeBytes: buffer.length,
  }
}
