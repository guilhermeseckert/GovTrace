// Pure type module — no runtime imports. Safe to import from client components
// (AISummary, FactBlock) without dragging postgres/drizzle into the client bundle.

export type LargestDeal = {
  value: number
  department: string | null
  year: number | null
  dataset: 'contract' | 'grant' | 'aid'
}

export type EntityAggregates = {
  contractsTotal: number
  contractsCount: number
  grantsTotal: number
  grantsCount: number
  donationsTotal: number
  donationsCount: number
  lobbyingCount: number
  aidTotal: number
  aidCount: number
  earliestYear: number | null
  latestYear: number | null
  primaryDepartment: string | null
  largestDeal: LargestDeal | null
}
