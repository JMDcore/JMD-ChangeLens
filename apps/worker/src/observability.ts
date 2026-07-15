import { createServer, type Server } from "node:http";

import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export interface WorkerMetrics {
  extractionJobs: Counter<"status" | "renderer">;
  extractionDuration: Histogram<"renderer">;
  webhookJobs: Counter<"status">;
}

export function createWorkerMetrics(): { metrics: WorkerMetrics; registry: Registry } {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "changelens_worker_" });
  return {
    registry,
    metrics: {
      extractionJobs: new Counter({
        name: "changelens_worker_extraction_jobs_total",
        help: "Completed extraction processing attempts",
        labelNames: ["status", "renderer"],
        registers: [registry],
      }),
      extractionDuration: new Histogram({
        name: "changelens_worker_extraction_duration_seconds",
        help: "End-to-end extraction duration",
        labelNames: ["renderer"],
        buckets: [0.5, 1, 2.5, 5, 10, 20, 30, 60, 120],
        registers: [registry],
      }),
      webhookJobs: new Counter({
        name: "changelens_worker_webhook_jobs_total",
        help: "Webhook delivery attempts",
        labelNames: ["status"],
        registers: [registry],
      }),
    },
  };
}

export async function startHealthServer(
  port: number,
  registry: Registry,
  isReady: () => boolean,
): Promise<{ close: () => Promise<void> }> {
  const server: Server = createServer(async (request, response) => {
    if (request.url === "/health") {
      const ready = isReady();
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: ready ? "ready" : "starting", service: "changelens-worker" }));
      return;
    }
    if (request.url === "/metrics") {
      response.writeHead(200, { "content-type": registry.contentType });
      response.end(await registry.metrics());
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });

  return {
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
