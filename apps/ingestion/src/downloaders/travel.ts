import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'

// Source: https://open.canada.ca/data/en/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce
const TRAVEL_URL =
  'https://open.canada.ca/data/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce/resource/8282db2a-878f-475c-af10-ad56aa8fa72c/download/travelq.csv'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

/**
 * Downloads the federal travel disclosures CSV from open.canada.ca.
 * Streams to disk to handle large files (~65 MB, ~159K records).
 */
export async function downloadTravel(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const response = await fetch(TRAVEL_URL, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(
      `Failed to download travel CSV: ${response.status} ${response.statusText}`,
    )
  }

  const localPath = join(destDir, 'travelq.csv')
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
