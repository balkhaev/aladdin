# syntax=docker/dockerfile:1.5

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy workspace packages so Bun keeps directory structure
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

# Install dependencies
RUN bun install

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Build Next.js application
WORKDIR /app/apps/web
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install minimal dependencies for runtime
RUN apk add --no-cache libc6-compat

# Copy dependencies and built app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/next.config.ts ./apps/web/next.config.ts

WORKDIR /app/apps/web

EXPOSE 3001

ENV HOSTNAME="0.0.0.0"
ENV PORT=3001

CMD ["bun", "run", "start"]
