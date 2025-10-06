# syntax=docker/dockerfile:1.5
FROM oven/bun:1 AS builder

WORKDIR /app

COPY . .

ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
ARG PRISMA_SCHEMA_PATH="./packages/database/prisma/schema/schema.prisma"

RUN test -f "$PRISMA_SCHEMA_PATH" || (echo "Prisma schema not found at $PRISMA_SCHEMA_PATH. Ensure the Docker build context includes the monorepo root." && exit 1)

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN bun install --frozen-lockfile --ignore-scripts \
  && DATABASE_URL="$DATABASE_URL" \
    bunx prisma generate --schema "$PRISMA_SCHEMA_PATH"

WORKDIR /app/apps/web
RUN bun run build

FROM nginx:alpine

# Environment variables for nginx config
ENV PORT=80 \
    API_PROXY_TARGET="http://gateway:3000" \
    WS_PROXY_TARGET="http://gateway:3000" \
    NGINX_RESOLVER="127.0.0.11"

# Copy nginx config template
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

# Copy diagnostic script
COPY apps/web/diagnose.sh /diagnose.sh
RUN chmod +x /diagnose.sh

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

EXPOSE 80

CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
