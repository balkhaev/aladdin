# syntax=docker/dockerfile:1.5

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy only package files for better caching
COPY package.json bun.lockb ./
COPY apps/analytics/package.json ./apps/analytics/
COPY packages/*/package.json ./packages/

# Install dependencies
RUN bun install --frozen-lockfile

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

# Stage 3: Runner
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/analytics ./apps/analytics

WORKDIR /app/apps/analytics

EXPOSE 3014

CMD ["bun", "run", "start"]
