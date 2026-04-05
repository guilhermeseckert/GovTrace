FROM node:20-alpine AS base
RUN npm install -g pnpm@9 tsx

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
COPY apps/ingestion/package.json ./apps/ingestion/
RUN pnpm install --frozen-lockfile

COPY packages/db ./packages/db
COPY apps/ingestion ./apps/ingestion

CMD ["node", "--import", "tsx/esm", "apps/ingestion/src/index.ts", "scheduler"]
