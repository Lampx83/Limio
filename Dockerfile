# syntax=docker/dockerfile:1.7
# Multi-stage build for the FeedBackMe Next.js monorepo (pnpm workspaces).
# Targets:
#   - runner   : production web server (default)
#   - migrator : Prisma CLI + schema for `prisma migrate deploy`
#   - worker   : BullMQ background worker (realtime publish, future: badge/email jobs)

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
# Optional sub-path prefix (e.g. /limio). Empty = serve from root.
# Override at build time: docker compose build --build-arg NEXT_PUBLIC_BASE_PATH=/limio
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/core-lms/node_modules ./packages/core-lms/node_modules
COPY --from=deps /app/packages/core-feedback/node_modules ./packages/core-feedback/node_modules
COPY --from=deps /app/packages/core-gamification/node_modules ./packages/core-gamification/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .
# Generate Prisma client for builder. prisma CLI lives in packages/db/node_modules
# (pnpm workspace devDependency), not necessarily hoisted to root — use find.
RUN set -eux; \
    PRISMA=$( \
      find /app/packages/db/node_modules/.bin /app/node_modules/.bin \
           -name prisma -type f 2>/dev/null | head -1 \
    ); \
    test -n "$PRISMA" || { echo "ERROR: Prisma CLI not found"; exit 1; }; \
    "$PRISMA" generate --schema=/app/packages/db/prisma/schema.prisma
# Persistent BuildKit cache for Next.js incremental compilation.
# On the self-hosted runner (server 224) this cache survives between deploys:
# unchanged modules are NOT recompiled, cutting typical build time by ~50%.
# The id is stable so every deploy shares the same cache volume.
# On ephemeral GitHub-hosted CI runners the mount exists but starts empty —
# the build is a cold build, same as before.
RUN --mount=type=cache,id=nextjs-build-cache,target=/app/apps/web/.next/cache \
    pnpm --filter @feedbackme/web build

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
# IMPORTANT: migrator intentionally does NOT inherit from builder.
# builder runs `next build` (~70 s). When compose builds web+migrate in
# parallel both used to run next build — doubling build time for no reason.
# migrator only needs prisma CLI + schema; we copy node_modules from the
# deps stage and run prisma:generate here (~5 s) instead.
FROM base AS migrator
ENV NODE_ENV=production
# Root node_modules from deps stage.
COPY --from=deps /app/node_modules ./node_modules
# packages/db/node_modules from deps stage — prisma CLI lives here in pnpm
# workspaces (it is a devDependency of packages/db, not hoisted to root).
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
# Source files from the build context (not from builder).
COPY packages/db ./packages/db
# shared-types is needed by seed scripts (imported as @feedbackme/shared-types).
# pnpm links workspace packages via a symlink in node_modules that points to
# the actual source directory — so the source must exist in the image too.
COPY packages/shared-types ./packages/shared-types
COPY package.json pnpm-workspace.yaml ./
# Generate Prisma client (~5 s). Try packages/db/node_modules first (pnpm
# workspace location), fall back to root node_modules (hoisted setups).
RUN set -eux; \
    PRISMA=$( \
      find /app/packages/db/node_modules/.bin /app/node_modules/.bin \
           -name prisma -type f 2>/dev/null | head -1 \
    ); \
    test -n "$PRISMA" || { echo "ERROR: prisma binary not found"; exit 1; }; \
    "$PRISMA" generate --schema=/app/packages/db/prisma/schema.prisma
WORKDIR /app/packages/db
# Run migrations, then idempotent seeds (upsert-based — safe to run every deploy).
# Mission templates are required for the instructor tournament mission picker UI;
# without them the picker renders empty and instructors can't author missions.
# Seed failures are non-fatal: migrations have already succeeded, web can boot.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && (pnpm exec tsx src/seed-mission-templates.ts || echo 'WARN: mission-templates seed failed (non-fatal)')"]

# ---------- runner (Next.js standalone) ----------
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Carry the sub-path prefix into the runner so the HEALTHCHECK curl hits
# the correct URL. Must match NEXT_PUBLIC_BASE_PATH used at build time.
# Empty = served from domain root (e.g. docker build without --build-arg).
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

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

# NEXT_PUBLIC_BASE_PATH is "" or "/limio" — include it so the healthcheck
# hits an actual route.  With basePath=/limio, GET / returns 404; only
# /limio/... routes exist.  Shell form (no brackets) expands the env var.
# start-period=30s: Next.js standalone starts in <1 s; 30 s gives generous
# headroom for Prisma's first lazy connection without eating into the retry
# budget.  Previously 60 s — halved to cut ~30 s from every deploy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3000${NEXT_PUBLIC_BASE_PATH}/" >/dev/null || exit 1

CMD ["node", "apps/web/server.js"]

# ---------- worker (BullMQ background processes, runs `tsx src/worker/index.ts`) ----------
# Worker dùng tsx để chạy TypeScript thẳng — không cần next build.
# Khác với `runner` (Next standalone tối giản), worker cần full node_modules để
# resolve bullmq, ioredis, tsx và (sau này) Prisma client khi job ghi DB.
FROM base AS worker
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Full node_modules từ deps stage — không tree-shake vì tsx import động.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/core-lms/node_modules ./packages/core-lms/node_modules
COPY --from=deps /app/packages/core-feedback/node_modules ./packages/core-feedback/node_modules
COPY --from=deps /app/packages/core-gamification/node_modules ./packages/core-gamification/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules

# Source files. Copy nguyên repo cho gọn — image vẫn nhỏ vì không có .next build.
# Nếu sau này muốn tối ưu, chỉ copy: apps/web/{src,tsconfig.json,package.json},
# packages/{db,shared-types,...} cần để workspace symlink resolve được.
COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
COPY packages ./packages

# Prisma generate phòng khi worker job sau này import @feedbackme/db.
# Bỏ qua lỗi nếu schema chưa cần — chỉ là tiền đề cho Phase tiếp.
RUN set -eux; \
    PRISMA=$( \
      find /app/packages/db/node_modules/.bin /app/node_modules/.bin \
           -name prisma -type f 2>/dev/null | head -1 \
    ); \
    if [ -n "$PRISMA" ] && [ -f /app/packages/db/prisma/schema.prisma ]; then \
      "$PRISMA" generate --schema=/app/packages/db/prisma/schema.prisma; \
    fi

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker && \
    chown -R worker:nodejs /app
USER worker

WORKDIR /app/apps/web
# Healthcheck: worker không expose HTTP. Dùng node script kiểm Redis ping nếu cần,
# hoặc dựa vào compose restart policy. Giữ tối giản cho Phase 1.3.
CMD ["pnpm", "exec", "tsx", "src/worker/index.ts"]
