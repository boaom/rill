# syntax=docker/dockerfile:1.7
# Rill：前端多阶段构建 + Node 26 零依赖 server。
FROM node:26-alpine AS build
WORKDIR /app

# 只在构建阶段安装 pnpm（运行时镜像不包含 npm 依赖）。
RUN npm install -g pnpm@11.28.5

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json vite.config.ts index.html ./
COPY scripts ./scripts
COPY src ./src
COPY server ./server
RUN pnpm build

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    RILL_HOST=0.0.0.0 \
    RILL_PORT=8787 \
    RILL_DB=/app/data/rill.sqlite \
    RILL_PROVIDER=mock

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/data/mock.json ./src/data/mock.json
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]