# syntax=docker/dockerfile:1.7
# Multi-stage build for the FeedBackMe Next.js monorepo (pnpm workspaces).
# Targets:
#   - runner   : production web server (default)
#   - migrator : Prisma CLI + schema for `prisma migrate deploy`

ARG NODE_VERSION=20-alpine

# ---------- base ----------
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app

# ---------- deps (full install, cached on lockfile) ----------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/core-lms/package.json packages/core-lms/
COPY packages/core-feedback/package.json packages/core-feedback/
COPY packages/core-gamification/package.json packages/core-gamification/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/core-lms/node_modules ./packages/core-lms/node_modules
COPY --from=deps /app/packages/core-feedback/node_modules ./packages/core-feedback/node_modules
COPY --from=deps /app/packages/core-gamification/node_modules ./packages/core-gamification/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .
RUN pnpm --filter @feedbackme/db prisma:generate
RUN pnpm --filter @feedbackme/web build

# ---------- migrator (Prisma CLI + schema + generated client) ----------
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
WORKDIR /app/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---------- runner (Next.js standalone) ----------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone Next.js bundle (includes minimal node_modules + prisma client).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Persisted user uploads.
RUN mkdir -p /app/apps/web/uploads && chown -R nextjs:nodejs /app/apps/web/uploads
VOLUME ["/app/apps/web/uploads"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "apps/web/server.js"]
