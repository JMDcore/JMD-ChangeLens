FROM node:24-alpine AS build

WORKDIR /workspace
RUN npm install --global pnpm@11.7.0

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @changelens/web... build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /workspace/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
