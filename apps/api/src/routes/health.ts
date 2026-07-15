import type { FastifyInstance } from "fastify";

import type { ApiDependencies } from "../types.js";

export async function registerHealthRoutes(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  app.get("/api/health", async () => ({ status: "ok", service: "changelens-api", version: "0.1.0" }));

  app.get("/api/ready", async (_request, reply) => {
    const checks: Record<string, "ok" | "error"> = { database: "error", redis: "error", storage: "error" };
    try {
      await dependencies.database.pool.query("select 1");
      checks.database = "ok";
    } catch (error) {
      app.log.warn({ error }, "Database readiness check failed");
    }
    try {
      if (dependencies.queues.connection.status === "wait") await dependencies.queues.connection.connect();
      await dependencies.queues.connection.ping();
      checks.redis = "ok";
    } catch (error) {
      app.log.warn({ error }, "Redis readiness check failed");
    }
    try {
      await dependencies.screenshots.assertReady();
      checks.storage = "ok";
    } catch (error) {
      app.log.warn({ error }, "Object storage readiness check failed");
    }

    const ready = Object.values(checks).every((check) => check === "ok");
    return reply.code(ready ? 200 : 503).send({ status: ready ? "ready" : "not_ready", checks });
  });
}
