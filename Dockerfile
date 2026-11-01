# One container: build the website, then run the API (which also serves the site).
# Same pattern as book-club — one public URL for pages + /api.

FROM node:22-bookworm-slim AS web
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
# Coolify may inject NODE_ENV=production and skip vite (devDependency).
RUN npm ci --include=dev
COPY client/ ./
# Same-origin: browser calls /api on this site. Leave empty (do not set VITE_API_URL in Coolify).
ENV VITE_API_URL=
RUN npm run build

FROM node:22-bookworm-slim AS app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# prisma + tsx + typescript needed for generate / migrate / seed / tsc build
RUN npm ci --include=dev
COPY server/ ./
RUN npx prisma generate && npm run build
COPY --from=web /src/client/dist /app/client/dist
ENV NODE_ENV=production
EXPOSE 3000
# Migrate schema, ensure admin user matches ADMIN_* env, then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && exec node dist/index.js"]
