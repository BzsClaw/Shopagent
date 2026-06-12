# ShopAgent Dockerfile — based on Open Design deploy pattern
# Reference: PRD §6.2 M15, §9

ARG NODE_IMAGE=docker.io/library/node:24-alpine
ARG RUNTIME_IMAGE=docker.io/library/node:24-alpine

FROM ${NODE_IMAGE} AS build

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ARG NO_PROXY

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}
ENV NO_PROXY=${NO_PROXY}
ENV CI=true

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/postinstall.mjs ./scripts/postinstall.mjs
COPY packages ./packages
COPY tools ./tools
COPY apps/daemon/package.json ./apps/daemon/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN corepack enable && \
    corepack prepare pnpm@10.33.2 --activate && \
    pnpm install --frozen-lockfile

COPY apps ./apps
RUN pnpm --filter @open-design/daemon build && \
    pnpm --filter @open-design/web build && \
    pnpm --filter @open-design/daemon deploy --legacy --prod /app/deploy/daemon && \
    pnpm store prune && \
    rm -rf \
      /root/.cache \
      /root/.local/share/pnpm/store \
      /app/deploy/daemon/node_modules/.cache \
      /app/deploy/daemon/node_modules/@types \
      /app/deploy/daemon/node_modules/.pnpm/@types+* \
      /app/deploy/daemon/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/deps \
      /app/deploy/daemon/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/src && \
    find /app/deploy/daemon/node_modules -type d \( \
      -name test -o \
      -name tests -o \
      -name "__tests__" -o \
      -name docs -o \
      -name doc -o \
      -name example -o \
      -name examples -o \
      -name ".github" \
    \) -prune -exec rm -rf '{}' + && \
    find /app/deploy/daemon/node_modules -type f \( \
      -name "*.md" -o \
      -name "*.markdown" -o \
      -name "*.d.ts" -o \
      -name "*.d.cts" -o \
      -name "*.d.mts" -o \
      -name "*.map" -o \
      -name "*.tsbuildinfo" -o \
      -name "binding.gyp" \
    \) -delete

# Stage-2 assets — ShopAgent needs skills + design-systems + craft + plugins.
COPY skills ./skills
COPY design-systems ./design-systems
COPY craft ./craft
COPY plugins ./plugins
COPY prompt-templates ./prompt-templates

FROM ${RUNTIME_IMAGE}

RUN apk add --no-cache tini poppler-utils && \
    addgroup -S -g 1001 shopagent && \
    adduser -S -D -H -u 1001 -G shopagent shopagent

WORKDIR /app
COPY --from=build --chown=shopagent:shopagent /app/deploy/daemon ./apps/daemon
COPY --from=build --chown=shopagent:shopagent /app/apps/web/out ./apps/web/out
COPY --from=build --chown=shopagent:shopagent /app/skills ./skills
COPY --from=build --chown=shopagent:shopagent /app/design-systems ./design-systems
COPY --from=build --chown=shopagent:shopagent /app/craft ./craft
COPY --from=build --chown=shopagent:shopagent /app/prompt-templates ./prompt-templates

RUN mkdir -p /app/.od && \
    chown -R shopagent:shopagent /app

# Patch: Docker bridge networking → single-user deployment bypass
RUN node -e "const fs=require('fs'),p='/app/apps/daemon/dist/server.js';let c=fs.readFileSync(p,'utf8');c=c.replace(/function isLoopbackPeerAddress\(address\)\s*\{[\s\S]*?^}/m,'function isLoopbackPeerAddress(address){return true}');fs.writeFileSync(p,c);console.log('patched')"

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=256
ENV OD_BIND_HOST=0.0.0.0
ENV OD_PORT=7456
# ShopAgent-specific env vars (set via docker-compose or k8s)
ENV DEEPSEEK_API_KEY=""
ENV APIMART_API_KEY=""

EXPOSE 7456

USER shopagent
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/daemon/dist/cli.js", "--no-open"]
