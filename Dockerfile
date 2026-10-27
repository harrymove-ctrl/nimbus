# Nimbus: one image for the Nebius Serverless Endpoint (web app + /v1) and Serverless Jobs (pnpm run:job).
# Build:  docker build -t nimbus .
# Run:    docker run -p 3000:3000 -v nimbus-data:/data -e NIMBUS_API_TOKEN=change-me nimbus
# No API keys are needed to run: without NEBIUS_API_KEY the scripted mock model is used.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
RUN corepack enable && apk add --no-cache python3
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NIMBUS_DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Dev dependencies stay: next.config.ts needs typescript at start and `pnpm run:job` runs through tsx.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/fixtures ./fixtures
RUN mkdir -p /data && chown -R node:node /data /app/.next
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/api/workstreams >/dev/null || exit 1
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
