# ─── OpenAgency API Server ───────────────────────────────────────────
# Multi-stage build: install + build, then slim runtime image.

# Stage 1: Build
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

# Copy workspace manifests first for better caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/core/package.json packages/core/
COPY packages/engines/package.json packages/engines/
COPY packages/connectors/package.json packages/connectors/
COPY packages/schemas/package.json packages/schemas/
COPY packages/auth/package.json packages/auth/
COPY packages/events/package.json packages/events/
COPY packages/memory/package.json packages/memory/
COPY packages/agent/package.json packages/agent/
COPY packages/hfl/package.json packages/hfl/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build all packages
RUN pnpm run build --filter=@openagency/api...

# Stage 2: Production
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3100/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
