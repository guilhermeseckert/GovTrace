// Parliament data downloaders
// Sources:
//   Aggregate votes: https://www.ourcommons.ca/members/en/votes/xml?parlSession={parliament}-{session}
//   Ballots: https://www.ourcommons.ca/members/en/votes/{parliament}/{session}/{divisionNumber}/xml
//   Members: https://www.ourcommons.ca/members/en/search/xml?parlSession={parliament}-{session}
//   Bills: https://www.parl.ca/legisinfo/en/bills/json?parlsession={parliament}-{session}&Language=E

export interface ParliamentSession {
  parliament: number
  session: number
  code: string // "{parliament}-{session}" e.g. "44-1"
  confirmed: boolean // false = 37th Parliament sessions, may return HTTP 500
}

// All sessions from 37th to 45th Parliament
// 37th Parliament sessions flagged confirmed: false — XML endpoint returns HTTP 500 (Pitfall 1)
export const PARLIAMENT_SESSIONS: ParliamentSession[] = [
  { parliament: 37, session: 1, code: '37-1', confirmed: false },
  { parliament: 37, session: 2, code: '37-2', confirmed: false },
  { parliament: 37, session: 3, code: '37-3', confirmed: false },
  { parliament: 38, session: 1, code: '38-1', confirmed: true },
  { parliament: 39, session: 1, code: '39-1', confirmed: true },
  { parliament: 39, session: 2, code: '39-2', confirmed: true },
  { parliament: 40, session: 1, code: '40-1', confirmed: true },
  { parliament: 40, session: 2, code: '40-2', confirmed: true },
  { parliament: 40, session: 3, code: '40-3', confirmed: true },
  { parliament: 41, session: 1, code: '41-1', confirmed: true },
  { parliament: 41, session: 2, code: '41-2', confirmed: true },
  { parliament: 42, session: 1, code: '42-1', confirmed: true },
  { parliament: 43, session: 1, code: '43-1', confirmed: true },
  { parliament: 43, session: 2, code: '43-2', confirmed: true },
  { parliament: 44, session: 1, code: '44-1', confirmed: true },
  { parliament: 45, session: 1, code: '45-1', confirmed: true },
] as const

/**
 * Fetches aggregate vote listing XML for a parliament session.
 * Returns all divisions (vote summaries) for the session.
 * One request per session — 16 total for full history.
 *
 * @throws Error on non-200 HTTP responses
 */
export async function fetchVotesXml(parliament: number, session: number): Promise<string> {
  const url = `https://www.ourcommons.ca/members/en/votes/xml?parlSession=${parliament}-${session}`
  const response = await fetch(url, {
    headers: { 'Accept': 'application/xml, text/xml, */*' },
  })
  if (!response.ok) {
    throw new Error(
      `fetchVotesXml failed for ${parliament}-${session}: HTTP ${response.status} ${response.statusText}`,
    )
  }
  return response.text()
}

/**
 * Fetches individual MP ballot XML for a single division.
 * Returns all ~338 MP votes for that division.
 * One request per division — use 100ms delay between requests (Pitfall 2).
 *
 * @throws Error on non-200 HTTP responses
 */
export async function fetchBallotsXml(
  parliament: number,
  session: number,
  divisionNumber: number,
): Promise<string> {
  const url = `https://www.ourcommons.ca/members/en/votes/${parliament}/${session}/${divisionNumber}/xml`
  const response = await fetch(url, {
    headers: { 'Accept': 'application/xml, text/xml, */*' },
  })
  if (!response.ok) {
    throw new Error(
      `fetchBallotsXml failed for division ${parliament}-${session}-${divisionNumber}: HTTP ${response.status} ${response.statusText}`,
    )
  }
  return response.text()
}

/**
 * Fetches Members of Parliament XML for a parliament session.
 * Used to seed mp_profiles before ballot ingestion.
 * ~340 records per session, instant download.
 *
 * @throws Error on non-200 HTTP responses
 */
export async function fetchMembersXml(parliament: number, session: number): Promise<string> {
  const url = `https://www.ourcommons.ca/members/en/search/xml?parlSession=${parliament}-${session}`
  const response = await fetch(url, {
    headers: { 'Accept': 'application/xml, text/xml, */*' },
  })
  if (!response.ok) {
    throw new Error(
      `fetchMembersXml failed for ${parliament}-${session}: HTTP ${response.status} ${response.statusText}`,
    )
  }
  return response.text()
}

/**
 * Fetches LEGISinfo bills JSON for a parliament session.
 * Returns all bills (~75–200 per session) with titles, status, and sponsor.
 *
 * @throws Error on non-200 HTTP responses
 */
export async function fetchBillsJson(parliament: number, session: number): Promise<string> {
  const url = `https://www.parl.ca/legisinfo/en/bills/json?parlsession=${parliament}-${session}&Language=E`
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json, */*' },
  })
  if (!response.ok) {
    throw new Error(
      `fetchBillsJson failed for ${parliament}-${session}: HTTP ${response.status} ${response.statusText}`,
    )
  }
  return response.text()
}
