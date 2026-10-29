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
# the public address goes into the prerendered share-image URLs (Railway passes service variables to declared ARGs)
ARG NIMBUS_PUBLIC_URL
ENV NIMBUS_PUBLIC_URL=$NIMBUS_PUBLIC_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
# python3: the Analyst's run_code; git: git apply / git diff in Ship Nimbus (there is no repository in the image, so read_repo diff says so)
RUN corepack enable && apk add --no-cache python3 git
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NIMBUS_DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Dev dependencies stay: next.config.ts needs typescript at start and `pnpm run:job` runs through tsx.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json /app/pnpm-lock.yaml ./
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/fixtures ./fixtures
# Ship Nimbus really runs `pnpm eval --only` and `pnpm typecheck` inside the container: the goldens and the tsconfig must be there
COPY --from=build /app/evals ./evals
RUN mkdir -p /data && chown -R node:node /data /app/.next
USER node
# /data is the volume: `docker run -v nimbus-data:/data`, or the platform's volume (Railway rejects a VOLUME line)
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/api/workstreams >/dev/null || exit 1
# PORT from the platform when it sets one (Railway does), else 3000. NIMBUS_PRUNE_SEED=dry|yes runs scripts/prune-seed.mts
# on the volume first (the platform's shell may be out of reach); its counts land in the deploy logs. Unset it afterwards.
CMD ["sh", "-c", "case \"$NIMBUS_PRUNE_SEED\" in dry) node --import tsx scripts/prune-seed.mts ;; yes) node --import tsx scripts/prune-seed.mts --yes ;; esac; exec pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
