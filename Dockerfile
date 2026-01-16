FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:20-bookworm-slim AS build

WORKDIR /app

# Vite variables (frontend) are baked at build time.
# Coolify must provide these as build args (or as build-time env vars) for the client build.
ARG VITE_ALLOW_REGISTRATION
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY
ARG VITE_SENTRY_DSN
ARG VITE_APP_ENV
ARG VITE_APP_VERSION

ENV VITE_ALLOW_REGISTRATION=$VITE_ALLOW_REGISTRATION
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Install deps (dev + prod) for build tooling
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS=--enable-source-maps

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/healthz', { signal: AbortSignal.timeout(3000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.cjs"]
