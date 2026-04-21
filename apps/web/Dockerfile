FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
COPY apps/ingestion/package.json ./apps/ingestion/
RUN pnpm install --frozen-lockfile

# Build the application
FROM deps AS builder
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY apps/web ./apps/web
ENV DATABASE_URL=placeholder
RUN pnpm --filter @govtrace/web build
RUN pnpm --filter @govtrace/web build:server

# Production image
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
COPY apps/ingestion/package.json ./apps/ingestion/
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/server.js ./apps/web/server.js

WORKDIR /app/apps/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
