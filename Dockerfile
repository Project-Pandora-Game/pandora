FROM docker.io/node:24.13.1-alpine AS builder

# Update and enable corepack
RUN npm install -g corepack@latest
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app
ENV CI=true

# Files required by pnpm to fetch dependencies
COPY .npmrc package.json pnpm-lock.yaml ./
# Copy patches folder (if we have any patches)
COPY ./patches ./patches

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack prepare

# Bundle app source
COPY . ./

RUN --mount=type=cache,id=pnpm,sharing=locked,target=/pnpm/store \
	pnpm install -r --frozen-lockfile

# Build
RUN pnpm -r --filter pandora-common --filter 'pandora-server-*' run build

# Shrinkwrap for deployment
RUN --mount=type=cache,id=pnpm,sharing=locked,target=/pnpm/store \
	pnpm deploy --filter=pandora-server-directory --prod /app/deploy/directory

RUN --mount=type=cache,id=pnpm,sharing=locked,target=/pnpm/store \
	pnpm deploy --filter=pandora-server-shard --prod /app/deploy/shard

# Directory production image
FROM docker.io/node:24.13.1-alpine AS pandora-server-directory

WORKDIR /app

COPY --from=builder /app/deploy/directory /app

CMD ["node", "--enable-source-maps", "dist/index.js"]

# Shard production image
FROM docker.io/node:24.13.1-alpine AS pandora-server-shard

WORKDIR /app

COPY --from=builder /app/deploy/shard /app

CMD ["node", "--enable-source-maps", "dist/index.js"]
