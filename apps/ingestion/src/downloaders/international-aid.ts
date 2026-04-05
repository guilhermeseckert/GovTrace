import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const IATI_BASE_URL =
  'https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/'

export const IATI_FILES = [
  {
    name: 'status_2_3',
    url: `${IATI_BASE_URL}dfatd-maecd_activit_status_2_3.xml`,
  },
  {
    name: 'status_4',
    url: `${IATI_BASE_URL}dfatd-maecd_activit_status_4.xml`,
  },
  {
    name: 'status_4a',
    url: `${IATI_BASE_URL}dfatd-maecd_activit_status_4a.xml`,
  },
  {
    name: 'status_4b',
    url: `${IATI_BASE_URL}dfatd-maecd_activit_status_4b.xml`,
  },
] as const

export interface DownloadResult {
  name: string
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

async function downloadFile(url: string, localPath: string): Promise<{ fileHash: string; fileSizeBytes: number }> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  const body = response.body
  if (!body) throw new Error(`No response body for ${url}`)

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

  return { fileHash, fileSizeBytes: Number(fileStat.size) }
}

/**
 * Downloads all 4 IATI XML files from Global Affairs Canada.
 * Optionally checks for a status_4c file (pre-2017) and downloads it if present.
 * Returns an array of DownloadResult for each successfully downloaded file.
 */
export async function downloadInternationalAid(destDir: string): Promise<DownloadResult[]> {
  await mkdir(destDir, { recursive: true })

  const results: DownloadResult[] = []

  for (const file of IATI_FILES) {
    const localPath = join(destDir, `iati-${file.name}.xml`)
    console.log(`Downloading IATI ${file.name}...`)
    const { fileHash, fileSizeBytes } = await downloadFile(file.url, localPath)
    console.log(`  Downloaded ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB, hash: ${fileHash.slice(0, 8)}...`)
    results.push({ name: file.name, localPath, fileHash, fileSizeBytes })
  }

  // Optionally check for status_4c (pre-2017 closed projects)
  const status4cUrl = `${IATI_BASE_URL}dfatd-maecd_activit_status_4c.xml`
  try {
    const headResponse = await fetch(status4cUrl, { method: 'HEAD', redirect: 'follow' })
    if (headResponse.ok) {
      const localPath = join(destDir, 'iati-status_4c.xml')
      console.log('Downloading IATI status_4c (found)...')
      const { fileHash, fileSizeBytes } = await downloadFile(status4cUrl, localPath)
      console.log(`  Downloaded ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB, hash: ${fileHash.slice(0, 8)}...`)
      results.push({ name: 'status_4c', localPath, fileHash, fileSizeBytes })
    } else {
      console.log('IATI status_4c not found (skipping)')
    }
  } catch {
    // Silently skip if status_4c doesn't exist or network error
    console.log('IATI status_4c check failed (skipping)')
  }

  return results
}
