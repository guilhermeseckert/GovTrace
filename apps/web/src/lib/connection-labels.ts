export const CONNECTION_LABELS: Record<string, { label: string; color: string }> = {
  donor_to_party: { label: 'Donated to', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  vendor_to_department: { label: 'Contract with', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  grant_recipient_to_department: { label: 'Grant from', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  lobbyist_to_official: { label: 'Lobbied', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  lobbyist_client_to_official: { label: 'Lobbied for', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
}

export function formatAmount(amount: string | null): string {
  if (!amount) return '\u2014'
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}
