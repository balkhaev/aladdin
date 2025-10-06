# syntax=docker/dockerfile:1.5
FROM oven/bun:1 AS builder

WORKDIR /app

COPY . .

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN bun install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/web
RUN bun run build

FROM nginx:alpine

# Environment variables for nginx config
ENV PORT=3001 \
    API_PROXY_TARGET="http://gateway:3000" \
    WS_PROXY_TARGET="http://gateway:3000" \
    NGINX_RESOLVER="127.0.0.11"

# Copy nginx config template
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 3001

CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]
