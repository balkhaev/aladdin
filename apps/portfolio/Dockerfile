# syntax=docker/dockerfile:1.5
FROM oven/bun:1

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

WORKDIR /app/apps/portfolio

ENV NODE_ENV=production
EXPOSE 3012

CMD ["bun", "run", "start"]
