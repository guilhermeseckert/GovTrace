import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import unzipper from 'unzipper'

const SOURCE_URL =
  'https://lobbycanada.gc.ca/media/zwcjycef/registrations_enregistrements_ocl_cal.zip'

export interface DownloadResult {
  localPath: string // Path to PrimaryExport CSV (backward compatible)
  fileHash: string
  fileSizeBytes: number
  extractedFiles: Record<string, string> // filename -> absolute path for ALL CSVs
}

export async function downloadLobbyRegistrations(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  console.log('Downloading lobby registrations ZIP...')
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'GovTrace/1.0 (civic data research)',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to download lobby registrations: HTTP ${response.status} ${response.statusText}`,
    )
  }

  const zipPath = join(destDir, 'lobby-registrations.zip')
  const body = response.body
  if (!body) throw new Error('No response body')

  const hash = createHash('sha256')
  const fileStream = createWriteStream(zipPath)
  const webStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream)

  await new Promise<void>((resolve, reject) => {
    webStream.on('data', (chunk: Buffer) => hash.update(chunk))
    webStream.pipe(fileStream)
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
    webStream.on('error', reject)
  })

  const fileHash = hash.digest('hex')
  const fileStat = await stat(zipPath)

  // Extract ALL CSVs from ZIP
  console.log('Extracting CSVs from ZIP...')
  const extractedFiles: Record<string, string> = {}
  let csvPath = ''
  const directory = await unzipper.Open.file(zipPath)
  for (const entry of directory.files) {
    if (entry.path.endsWith('.csv')) {
      const fileName = entry.path.split('/').pop() ?? entry.path
      const fileDest = join(destDir, fileName)
      await pipeline(entry.stream(), createWriteStream(fileDest))
      extractedFiles[fileName] = fileDest
      console.log(`Extracted: ${entry.path} → ${fileName}`)
      if (entry.path.includes('PrimaryExport')) {
        csvPath = fileDest
      }
    }
  }

  if (!csvPath) throw new Error('No PrimaryExport CSV file found in lobby registrations ZIP')

  return {
    localPath: csvPath,
    fileHash,
    fileSizeBytes: Number(fileStat.size),
    extractedFiles,
  }
}
