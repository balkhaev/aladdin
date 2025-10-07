# syntax=docker/dockerfile:1.5

# Stage 1: Dependencies
FROM oven/bun:1-debian AS deps

WORKDIR /app

# Install system dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Copy only package files for better caching
COPY package.json bun.lockb ./
COPY apps/scraper/package.json ./apps/scraper/
COPY packages/*/package.json ./packages/

ENV PUPPETEER_SKIP_DOWNLOAD=1

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Generate Prisma Client
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
ARG PRISMA_SCHEMA_PATH="./packages/database/prisma/schema/schema.prisma"

RUN test -f "$PRISMA_SCHEMA_PATH" || (echo "Prisma schema not found at $PRISMA_SCHEMA_PATH" && exit 1)
RUN DATABASE_URL="$DATABASE_URL" bunx prisma generate --schema "$PRISMA_SCHEMA_PATH"

# Build application
WORKDIR /app/apps/scraper
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1-debian AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=1

# Install runtime dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/scraper ./apps/scraper

WORKDIR /app/apps/scraper

EXPOSE 3018

CMD ["bun", "run", "start"]
