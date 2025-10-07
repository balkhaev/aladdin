# syntax=docker/dockerfile:1.5

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy workspace packages so Bun keeps directory structure
COPY package.json bun.lock ./
COPY apps/market-data/package.json ./apps/market-data/
COPY packages ./packages

# Install dependencies
RUN bun install

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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
WORKDIR /app/apps/market-data
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/market-data ./apps/market-data

WORKDIR /app/apps/market-data

EXPOSE 3010

CMD ["bun", "run", "start"]
