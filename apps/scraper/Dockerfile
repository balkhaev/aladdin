# syntax=docker/dockerfile:1.5
FROM oven/bun:1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    openssl \
  && rm -rf /var/lib/apt/lists/*

COPY . .

ENV PUPPETEER_SKIP_DOWNLOAD=1

ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
ARG PRISMA_SCHEMA_PATH="./packages/database/prisma/schema/schema.prisma"

RUN test -f "$PRISMA_SCHEMA_PATH" || (echo "Prisma schema not found at $PRISMA_SCHEMA_PATH. Ensure the Docker build context includes the monorepo root." && exit 1)

RUN bun install --frozen-lockfile --ignore-scripts \
  && DATABASE_URL="$DATABASE_URL" \
    bunx prisma generate --schema "$PRISMA_SCHEMA_PATH"

WORKDIR /app/apps/scraper
RUN bun run build

ENV NODE_ENV=production
EXPOSE 3018

CMD ["bun", "run", "start"]
