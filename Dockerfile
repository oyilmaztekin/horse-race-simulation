# syntax=docker/dockerfile:1.7

# --- Stage 1: web build (Vue SPA -> /app/dist) -----------------------------
FROM node:20-alpine AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts vitest.config.ts postcss.config.js tailwind.config.ts ./
COPY index.html ./
COPY src ./src
RUN npm run build

# --- Stage 2: server deps (prod node_modules + prisma client) --------------
FROM node:20-alpine AS server-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save tsx@4.19.2 prisma@5.22.0
COPY prisma ./prisma
RUN npx prisma generate

# --- Stage 3: runtime (nginx + node + supervisord) -------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache nginx supervisor openssl
WORKDIR /app

# Server runtime: package manifest, deps, generated Prisma client
COPY --from=server-build /app/package.json ./package.json
COPY --from=server-build /app/package-lock.json ./package-lock.json
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/prisma ./prisma

# Server source (run with tsx at runtime; no separate TS compile step)
COPY server ./server
COPY src/domain ./src/domain
COPY tsconfig.json ./tsconfig.json
COPY server/tsconfig.json ./server/tsconfig.json

# SPA bundle served by nginx
COPY --from=web-build /app/dist /usr/share/nginx/html

# nginx + supervisord configs + entrypoint
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /run/nginx /var/log/supervisor

ENV HOST=127.0.0.1
ENV PORT=3001
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/prisma/dev.db"

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
