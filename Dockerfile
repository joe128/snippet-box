# The tag floats on purpose: a no-cache rebuild (see the weekly CI job) picks up
# new Node security releases. The server refuses to start on an unpatched runtime.
ARG NODE_IMAGE=node:26-alpine
ARG PNPM_VERSION=12.21.0

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
# Toolchain for sqlite3 in case no prebuilt binary matches (e.g. ARM/musl)
RUN apk add --no-cache python3 make g++ \
    && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY client ./client
RUN pnpm build

# `docker build --target test` - runs the suite on the same Alpine/Node as production
FROM build AS test
COPY test ./test
CMD ["pnpm", "test"]

FROM base AS deps
RUN pnpm install --frozen-lockfile --prod --filter snippet-box

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
# OS security patches on every (re)build; npm/corepack/yarn are not needed at
# runtime and only add attack surface (and scanner findings)
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/client/build ./public
COPY package.json LICENCE.md ./
COPY --from=build /app/THIRD_PARTY_NOTICES.txt ./
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --start-interval=2s CMD wget -qO- http://127.0.0.1:5000/healthz >/dev/null || exit 1
CMD ["node", "build/server.js"]
