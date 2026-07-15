FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN npm install --global pnpm@11.7.0

COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @changelens/worker... build \
    && pnpm --filter @changelens/worker deploy --legacy --prod /opt/changelens-worker

FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runtime

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

COPY --from=build --chown=pwuser:pwuser /opt/changelens-worker ./

USER pwuser
EXPOSE 4001
CMD ["node", "dist/index.js"]
