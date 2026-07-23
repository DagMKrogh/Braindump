FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Builder stage
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/sync-service/package.json ./apps/sync-service/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/sync-service ./apps/sync-service

RUN pnpm --filter @braindump/shared build
RUN pnpm --filter @braindump/sync-service build

# Install Puppeteer Chrome for PDF export
RUN npx puppeteer browsers install chrome

# Production stage
FROM node:22-alpine AS production
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/sync-service/package.json ./apps/sync-service/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/sync-service/dist ./apps/sync-service/dist
COPY --from=builder /root/.cache/puppeteer /root/.cache/puppeteer

EXPOSE 3001

CMD ["node", "apps/sync-service/dist/index.js"]
