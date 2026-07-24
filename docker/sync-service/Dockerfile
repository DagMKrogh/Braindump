FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Install deps (layer-cached before source copy)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/sync-service/package.json ./apps/sync-service/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/sync-service ./apps/sync-service

# Build shared types
RUN pnpm --filter @braindump/shared build

# Generate Drizzle migration SQL from schema (no live DB needed for this step)
RUN DATABASE_URL=postgresql://x:x@localhost/x \
    pnpm --filter @braindump/sync-service db:generate

# Compile TypeScript
RUN pnpm --filter @braindump/sync-service build

# Install Puppeteer Chrome for PDF export
RUN npx puppeteer browsers install chrome

# ── Production ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_CACHE_DIR=/root/.cache/puppeteer

RUN corepack enable

# Install production deps only
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/sync-service/package.json ./apps/sync-service/

RUN pnpm install --frozen-lockfile --prod

# Copy compiled output + migration SQL + Puppeteer browser
COPY --from=builder /app/packages/shared/dist       ./packages/shared/dist
COPY --from=builder /app/apps/sync-service/dist     ./apps/sync-service/dist
COPY --from=builder /app/apps/sync-service/drizzle  ./apps/sync-service/drizzle
COPY --from=builder /root/.cache/puppeteer          /root/.cache/puppeteer

# Entrypoint: runs DB migrations then starts the server
COPY docker/sync-service/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
