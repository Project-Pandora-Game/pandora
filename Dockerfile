FROM docker.io/node:20.18.0-alpine AS builder

RUN corepack enable
WORKDIR /app
ENV CI=true

# Files required by pnpm to fetch dependencies
COPY .npmrc package.json pnpm-lock.yaml ./
COPY ./patches ./patches

RUN pnpm fetch

# Bundle app source
COPY . ./

RUN pnpm install -r --offline --frozen-lockfile

# Build
RUN pnpm -r --filter pandora-common --filter 'pandora-server-*' run build

# Shrinkwrap for deployment
RUN pnpm deploy --filter=pandora-server-directory --prod /app/deploy/directory
RUN pnpm deploy --filter=pandora-server-shard --prod /app/deploy/shard

# Directory production image
FROM docker.io/node:20.18.0-alpine AS pandora-server-directory

WORKDIR /app

COPY --from=builder /app/deploy/directory /app

CMD ["node", "--enable-source-maps", "dist/index.js"]

# Shard production image
FROM docker.io/node:20.18.0-alpine AS pandora-server-shard

WORKDIR /app

COPY --from=builder /app/deploy/shard /app

CMD ["node", "--enable-source-maps", "dist/index.js"]
