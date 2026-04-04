/**
 * Known Canadian organization acronyms for the lobbying registry.
 * Per Pitfall 7: lobbyist registry has systematic naming inconsistencies.
 * When an acronym appears as the entire name, expand it.
 */
export const ACRONYM_EXPANSIONS: Record<string, string> = {
  'mac': 'mining association of canada',
  'cba': 'canadian bar association',
  'cma': 'canadian medical association',
  'bdc': 'business development bank of canada',
  'cdc': 'canada development corporation',
  'cfe': 'canadian federation of enterprise',
  'cfib': 'canadian federation of independent business',
  'cga': 'certified general accountants',
  'cmpa': 'canadian motion picture association',
  'cpa': 'chartered professional accountants',
  'crtc': 'canadian radio-television and telecommunications commission',
  'nrcan': 'natural resources canada',
  'tc': 'transport canada',
  'hc': 'health canada',
  'ircc': 'immigration refugees and citizenship canada',
  'dnd': 'department of national defence',
  'pspc': 'public services and procurement canada',
  'tbs': 'treasury board of canada secretariat',
  'ised': 'innovation science and economic development canada',
}

export function expandAcronym(name: string): string {
  const normalized = name.trim().toLowerCase()
  return ACRONYM_EXPANSIONS[normalized] ?? name
}
