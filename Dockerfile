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
# Placeholder env for build-time only. Next.js may evaluate routes that touch
# Prisma / NextAuth during prerender — these vars must exist for parsers to pass,
# but no real connection is made. Real values are injected at runtime by compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXTAUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV SKIP_ENV_VALIDATION=1
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

# ---------- prisma-engine (extracts native binary for the runner) ----------
# Next.js standalone file tracing skips native .node binaries.  We locate the
# linux-musl engine in the builder's pnpm virtual store and park it in /tmp
# so the runner can COPY it to one of the paths Prisma searches at runtime.
FROM builder AS prisma-engine
RUN set -eux; \
    engine=$(find /app/node_modules -name "libquery_engine-linux-musl-openssl-3.0.x.so.node" -print -quit); \
    test -n "$engine" || { echo "ERROR: Prisma engine binary not found"; exit 1; }; \
    cp "$engine" /tmp/query_engine.node

# ---------- migrator (Prisma CLI + schema + generated client) ----------
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
# shared-types is needed by seed scripts (imported as @feedbackme/shared-types).
# pnpm links workspace packages via a symlink in node_modules that points to the
# actual source directory — so the source must exist in the image too.
COPY --from=builder /app/packages/shared-types ./packages/shared-types
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

# Prisma query engine — native .node binary that Next.js file tracer skips.
# Drop it into .next/server/ which is one of the paths Prisma searches at runtime
# (see "The following locations have been searched" in PrismaClientInitializationError).
COPY --from=prisma-engine --chown=nextjs:nodejs \
     /tmp/query_engine.node \
     /app/apps/web/.next/server/libquery_engine-linux-musl-openssl-3.0.x.so.node

# Persisted user uploads.
RUN mkdir -p /app/apps/web/uploads && chown -R nextjs:nodejs /app/apps/web/uploads
VOLUME ["/app/apps/web/uploads"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "apps/web/server.js"]
