import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import { ScrapeError } from "@changelens/scraper";

import { safeEqual } from "./lib/crypto.js";
import { AppError } from "./lib/errors.js";
import { CSRF_COOKIE, registerAuthentication } from "./plugins/auth.js";
import { registerMetrics } from "./plugins/metrics.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerExecutionRoutes } from "./routes/executions.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMonitorRoutes } from "./routes/monitors.js";
import type { ApiDependencies } from "./types.js";

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export async function buildServer(dependencies: ApiDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 1_048_576,
    genReqId: () => crypto.randomUUID(),
    logger: {
      level: dependencies.env.LOG_LEVEL,
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "request.body.password", "password", "webhookUrl"],
        censor: "[REDACTED]",
      },
    },
    requestIdHeader: false,
    trustProxy: false,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: dependencies.env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "x-changelens-csrf"],
    maxAge: 600,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  });
  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: "1 minute",
    ban: 3,
    keyGenerator: (request) => request.authUser?.id ?? request.ip,
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests. Retry in ${Math.ceil(context.ttl / 1_000)} seconds.`,
      },
    }),
  });

  app.addHook("preHandler", async (request) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    if (["/api/auth/login", "/api/auth/register"].includes(request.routeOptions.url ?? "")) return;

    const cookieToken = request.cookies[CSRF_COOKIE];
    const header = request.headers["x-changelens-csrf"];
    const headerToken = Array.isArray(header) ? header[0] : header;
    if (!safeEqual(cookieToken, headerToken)) {
      throw new AppError(403, "CSRF_VALIDATION_FAILED", "The request security token is missing or invalid");
    }
  });

  app.setNotFoundHandler(async (request, reply) =>
    reply.code(404).send({
      error: { code: "ROUTE_NOT_FOUND", message: "The requested API route does not exist", requestId: request.id },
    }),
  );

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId: request.id, details: error.details },
      });
    }
    if (error instanceof ScrapeError) {
      return reply.code(error.blocked ? 400 : 422).send({
        error: { code: error.code, message: error.message, requestId: request.id, details: error.details },
      });
    }
    if (databaseErrorCode(error) === "23505") {
      return reply.code(409).send({
        error: { code: "CONFLICT", message: "The resource conflicts with existing data", requestId: request.id },
      });
    }
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
    ) {
      const code = "code" in error && typeof error.code === "string" ? error.code : "REQUEST_ERROR";
      return reply.code(error.statusCode).send({
        error: { code, message: error.message, requestId: request.id },
      });
    }

    request.log.error({ error, requestId: request.id }, "Unhandled API error");
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId: request.id },
    });
  });

  await registerMetrics(app, dependencies);
  await registerHealthRoutes(app, dependencies);
  await registerAuthentication(app, dependencies);
  await registerDashboardRoutes(app, dependencies);
  await registerMonitorRoutes(app, dependencies);
  await registerExecutionRoutes(app, dependencies);

  return app;
}
