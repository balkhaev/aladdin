# syntax=docker/dockerfile:1.5
FROM oven/bun:1 AS builder

WORKDIR /app

COPY bun.lock bunfig.toml package.json turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/web
RUN bun run build

FROM oven/bun:1 AS runner

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app/apps/web

COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 3001

CMD ["bun", ".output/server/index.mjs"]
