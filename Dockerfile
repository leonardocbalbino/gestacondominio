# syntax=docker/dockerfile:1
# Imagens de produção (Postgres puro, sem Supabase):
#   --target web    → painel Next.js (standalone)
#   --target tools  → worker de fundo + migrações (tsx)

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@gc/web..." --filter "@gc/worker..." --filter "@gc/db..."
RUN NEXT_STANDALONE=1 pnpm --filter @gc/web build

# ---------------------------------------------------------------------
FROM node:22-alpine AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && mkdir -p /dados && chown app:app /dados
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---------------------------------------------------------------------
FROM base AS tools
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app && mkdir -p /dados && chown app:app /dados
COPY --from=build --chown=app:app /app /app
USER app
CMD ["apps/worker/node_modules/.bin/tsx", "apps/worker/src/index.ts"]
