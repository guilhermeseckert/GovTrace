import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'

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
 * Streams to disk to handle large files.
 */
export async function downloadContracts(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const response = await fetch(CONTRACTS_URL, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(
      `Failed to download contracts CSV: ${response.status} ${response.statusText}`,
    )
  }

  const localPath = join(destDir, 'contracts.csv')
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
