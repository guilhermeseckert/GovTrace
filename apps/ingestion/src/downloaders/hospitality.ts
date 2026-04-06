import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'

// Source: https://open.canada.ca/data/en/dataset/b9f51ef4-4605-4ef2-8231-62a2edda1b54
const HOSPITALITY_URL =
  'https://open.canada.ca/data/dataset/b9f51ef4-4605-4ef2-8231-62a2edda1b54/resource/7b301f1a-2a7a-48bd-9ea9-e0ac4a5313ed/download/hospitalityq.csv'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

/**
 * Downloads the federal hospitality disclosures CSV from open.canada.ca.
 * Streams to disk to handle large files (~26 MB, ~69K records).
 */
export async function downloadHospitality(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const response = await fetch(HOSPITALITY_URL, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(
      `Failed to download hospitality CSV: ${response.status} ${response.statusText}`,
    )
  }

  const localPath = join(destDir, 'hospitalityq.csv')
  const body = response.body
  if (!body) throw new Error('No response body')

  const hash = createHash('sha256')
  const fileStream = createWriteStream(localPath)
  const webStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream)

  await new Promise<void>((resolve, reject) => {
    webStream.on('data', (chunk: Buffer) => hash.update(chunk))
    webStream.pipe(fileStream)
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
    webStream.on('error', reject)
  })

  const fileHash = hash.digest('hex')
  const fileStat = await stat(localPath)

  return {
    localPath,
    fileHash,
    fileSizeBytes: Number(fileStat.size),
  }
}
