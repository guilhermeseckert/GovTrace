// Server-side env loader — call this at the start of any server function
// that needs non-VITE_ env vars (like ANTHROPIC_API_KEY).
let loaded = false

export async function ensureEnv() {
  if (loaded) return
  if (typeof process === 'undefined') return
  try {
    const { config } = await import('dotenv')
    const { resolve } = await import('node:path')
    config({ path: resolve(process.cwd(), '.env') })
    loaded = true
  } catch {
    // Not available (client-side) — skip
  }
}
