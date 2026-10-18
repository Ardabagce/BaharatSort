# syntax=docker/dockerfile:1
# Baharat Sort sunucusu (server/). Build bağlamı repo kökü: sunucu shared paketini kullanır.
# Coolify: Build Pack "Dockerfile", Base Directory "/", Dockerfile Location "/Dockerfile", port 3000.

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY app/package.json app/
COPY scripts/package.json scripts/
# Expo için kökte "hoisted" kullanılıyor; sunucu imajında yalnızca gereken paketler kurulsun.
RUN pnpm install --frozen-lockfile --filter "@baharat-sort/server..." --config.node-linker=isolated
COPY shared shared
COPY server server
RUN pnpm --filter @baharat-sort/server build

# Çalışma imajı: yalnızca tek dosyalık paket, node_modules yok.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=128
WORKDIR /app
COPY --from=build /repo/server/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
