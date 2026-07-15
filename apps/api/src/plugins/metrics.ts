import type { FastifyInstance } from "fastify";
import { collectDefaultMetrics, Histogram, Registry } from "prom-client";

import type { ApiDependencies } from "../types.js";

export async function registerMetrics(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "changelens_" });
  const responseTime = new Histogram({
    name: "changelens_http_request_duration_seconds",
    help: "API response duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  app.addHook("onResponse", async (request, reply) => {
    responseTime.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? "unmatched",
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime / 1_000,
    );
  });

  app.get("/api/metrics", async (request, reply) => {
    if (request.headers.authorization !== `Bearer ${dependencies.env.METRICS_TOKEN}`) {
      return reply.code(401).send({ error: { code: "METRICS_UNAUTHORIZED", message: "A metrics token is required" } });
    }
    reply.header("content-type", registry.contentType);
    return registry.metrics();
  });
}
