FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN npm install --global pnpm@11.7.0

COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @changelens/api... build \
    && pnpm --filter @changelens/api deploy --legacy --prod /opt/changelens-api

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /opt/changelens-api ./

USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
