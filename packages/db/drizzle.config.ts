import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://govtrace:govtrace@localhost:5432/govtrace',
  },
} satisfies Config
