import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import unzipper from 'unzipper'

const SOURCE_URL =
  'https://lobbycanada.gc.ca/media/mqbbmaqk/communications_ocl_cal.zip'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

export async function downloadLobbyCommunications(destDir: string): Promise<DownloadResult> {
  await mkdir(destDir, { recursive: true })

  console.log('Downloading lobby communications ZIP...')
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'GovTrace/1.0 (civic data research)',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to download lobby communications: HTTP ${response.status} ${response.statusText}`,
    )
  }

  const zipPath = join(destDir, 'lobby-communications.zip')
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

  // Extract CSV from ZIP
  console.log('Extracting CSV from ZIP...')
  let csvPath = ''
  const directory = await unzipper.Open.file(zipPath)
  for (const entry of directory.files) {
    if (entry.path.endsWith('.csv')) {
      const fileName = entry.path.split('/').pop() ?? entry.path
      csvPath = join(destDir, fileName)
      await pipeline(entry.stream(), createWriteStream(csvPath))
      console.log(`Extracted: ${entry.path} → ${fileName}`)
      break
    }
  }

  if (!csvPath) throw new Error('No CSV file found in lobby communications ZIP')

  return {
    localPath: csvPath,
    fileHash,
    fileSizeBytes: Number(fileStat.size),
  }
}
