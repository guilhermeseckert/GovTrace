import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Downloads the lobby communication reports bulk CSV export from lobbycanada.gc.ca.
 * Communication reports record individual meetings between lobbyists and public officials.
 * Open data reference: https://lobbycanada.gc.ca/en/open-data/
 */

const SOURCE_URL =
  'https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/cmmnctnSrch?lang=eng&export=true'

export interface DownloadResult {
  localPath: string
  fileHash: string
  fileSizeBytes: number
}

export async function downloadLobbyCommunications(): Promise<DownloadResult> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent':
        'GovTrace/1.0 (https://govtrace.ca; civic data research; contact@govtrace.ca)',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to download lobby communications: HTTP ${response.status} ${response.statusText}`,
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const fileHash = createHash('sha256').update(buffer).digest('hex')
  const localPath = join(tmpdir(), `lobby-communications-${fileHash.slice(0, 8)}.csv`)

  await writeFile(localPath, buffer)

  return {
    localPath,
    fileHash,
    fileSizeBytes: buffer.length,
  }
}
