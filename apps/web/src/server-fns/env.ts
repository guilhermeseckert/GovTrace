import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from monorepo root for server functions.
// Vite only exposes VITE_*-prefixed vars to import.meta.env;
// non-prefixed vars like ANTHROPIC_API_KEY need dotenv for process.env.
config({ path: resolve(import.meta.dirname, '../../../../.env') })
