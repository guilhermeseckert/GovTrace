FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile

# Build the application
FROM deps AS builder
WORKDIR /app
COPY packages/db ./packages/db
COPY packages/web ./packages/web
# Run database migrations before build
ENV DATABASE_URL=placeholder
RUN pnpm --filter @govtrace/web build
# Compile the server wrapper
RUN pnpm --filter @govtrace/web build:server

# Production image
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/web/server.js ./packages/web/server.js
COPY packages/web/tsconfig.json ./packages/web/

WORKDIR /app/packages/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
