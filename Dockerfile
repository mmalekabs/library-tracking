# One container: build the website, then run the API (which also serves the site).
# Stages are sequential (app waits for web) so only one npm download runs at a time —
# important on flaky home internet.

FROM node:22-bookworm-slim AS web
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
# Coolify may inject NODE_ENV=production and skip vite (devDependency).
RUN set -e; \
  for i in 1 2 3 4 5; do \
    echo "npm ci (client) attempt $i..."; \
    rm -rf node_modules; \
    npm ci --include=dev && break; \
    echo "npm ci failed, retrying in 20s..."; \
    sleep 20; \
  done; \
  test -d node_modules
COPY client/ ./
# Shared Funnel host with book-club: site lives under this path.
# Coolify Domain must be: https://bookclub.tail5716a1.ts.net/my-library-tracking-app
# Coolify strips the path prefix before the container; browser still calls under the path.
ARG VITE_BASE=/my-library-tracking-app/
ENV VITE_BASE=$VITE_BASE
ENV VITE_API_URL=/my-library-tracking-app/api
RUN npm run build

FROM node:22-bookworm-slim AS app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000
# Pull web output first so Docker does not run both npm ci jobs in parallel.
COPY --from=web /src/client/dist /app/client/dist
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# prisma + tsx + typescript needed for generate / migrate / seed / tsc build
RUN set -e; \
  for i in 1 2 3 4 5; do \
    echo "npm ci (server) attempt $i..."; \
    rm -rf node_modules; \
    npm ci --include=dev && break; \
    echo "npm ci failed, retrying in 20s..."; \
    sleep 20; \
  done; \
  test -d node_modules
COPY server/ ./
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Migrate schema, ensure admin user matches ADMIN_* env, then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && exec node dist/index.js"]
