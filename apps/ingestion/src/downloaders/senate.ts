// Senate of Canada vote data downloaders
// Source: https://sencanada.ca/en/in-the-chamber/votes/{parl}-{session} (HTML — no public API exists)
// Note: sencanada.ca uses Cloudflare; include User-Agent header and 200ms+ delay between requests

export interface SenateSession {
  parliament: number
  session: number
  code: string // "{parliament}-{session}" e.g. "44-1"
}

// All sessions from 39th Parliament onwards (earliest with digitized vote records on sencanada.ca)
export const SENATE_SESSIONS: SenateSession[] = [
  { parliament: 39, session: 1, code: '39-1' },
  { parliament: 39, session: 2, code: '39-2' },
  { parliament: 40, session: 1, code: '40-1' },
  { parliament: 40, session: 2, code: '40-2' },
  { parliament: 40, session: 3, code: '40-3' },
  { parliament: 41, session: 1, code: '41-1' },
  { parliament: 41, session: 2, code: '41-2' },
  { parliament: 42, session: 1, code: '42-1' },
  { parliament: 43, session: 1, code: '43-1' },
  { parliament: 43, session: 2, code: '43-2' },
  { parliament: 44, session: 1, code: '44-1' },
  { parliament: 45, session: 1, code: '45-1' },
] as const

const USER_AGENT = 'GovTrace/1.0 (civic tech; https://govtrace.ca)'

/**
 * Fetches the vote listing HTML page for a Senate session.
 * Contains a table of all standing votes with date, motion, yeas, nays, abstentions, result.
 *
 * @throws Error on non-200 HTTP responses
 */
export async function fetchSenateVoteListingHtml(parliament: number, session: number): Promise<string> {
  const url = `https://sencanada.ca/en/in-the-chamber/votes/${parliament}-${session}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,*/*',
    },
  })
  if (!response.ok) {
    throw new Error(
      `fetchSenateVoteListingHtml failed for ${parliament}-${session}: HTTP ${response.status} ${response.statusText}`,
    )
  }
  return response.text()
}

/**
 * Fetches the vote detail HTML page for a single Senate vote.
 * Contains per-senator ballot rows with name, group affiliation, province, and vote cast.
 * 200ms delay should be applied between calls by the runner (Cloudflare mitigation).
 *
 * @throws Error on non-200 HTTP responses
 */
export async function fetchSenateVoteDetailHtml(
  voteId: string,
  parliament: number,
  session: number,
): Promise<string> {
  const url = `https://sencanada.ca/en/in-the-chamber/votes/details/${voteId}/${parliament}-${session}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,*/*',
    },
  })
  if (!response.ok) {
    throw new Error(
      `fetchSenateVoteDetailHtml failed for vote ${voteId} ${parliament}-${session}: HTTP ${response.status} ${response.statusText}`,
    )
  }
  return response.text()
}
