import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import unzipper from 'unzipper'

// Source: https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip
const ELECTIONS_CANADA_URL = 'https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

/**
 * Downloads the Elections Canada contributions ZIP and extracts CSV files.
 * Uses streaming extraction to handle the 2GB+ uncompressed CSV.
 */
export async function downloadElectionsCanada(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  const zipPath = join(destDir, 'od_cntrbtn_audt_e.zip')

  // Stream download to disk (ZIP is ~300MB)
  console.log('Downloading Elections Canada contributions ZIP...')
  const response = await fetch(ELECTIONS_CANADA_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to download Elections Canada ZIP: ${response.status} ${response.statusText}`,
    )
  }

  const body = response.body
  if (!body) throw new Error('No response body')

  const hash = createHash('sha256')
  const fileStream = createWriteStream(zipPath)
  const webStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream)

  // Pipe through hash and to file simultaneously
  await new Promise<void>((resolve, reject) => {
    webStream.on('data', (chunk: Buffer) => hash.update(chunk))
    webStream.pipe(fileStream)
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
    webStream.on('error', reject)
  })

  const fileHash = hash.digest('hex')
  const fileStat = await stat(zipPath)

  // Stream-extract CSV from ZIP (handles 2GB+ files)
  console.log('Extracting CSV from ZIP (streaming)...')
  let csvPath = ''

  const directory = await unzipper.Open.file(zipPath)
  for (const entry of directory.files) {
    if (entry.path.endsWith('.csv')) {
      // Flatten nested paths (e.g. PoliticalFinance/od_cntrbtn_audt_e.csv → od_cntrbtn_audt_e.csv)
      const fileName = entry.path.split('/').pop() ?? entry.path
      csvPath = join(destDir, fileName)
      await pipeline(
        entry.stream(),
        createWriteStream(csvPath),
      )
      console.log(`Extracted: ${entry.path} → ${fileName} (${entry.uncompressedSize} bytes)`)
      break
    }
  }

  if (!csvPath) {
    throw new Error('No CSV file found in Elections Canada ZIP')
  }

  return {
    localPath: csvPath,
    fileHash,
    fileSizeBytes: Number(fileStat.size),
  }
}
