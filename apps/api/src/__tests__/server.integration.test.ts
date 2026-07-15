import { afterEach, describe, expect, it, vi } from "vitest";

import { loadApiEnvironment } from "@changelens/config";

import { buildServer } from "../server.js";
import type { ApiDependencies } from "../types.js";

const applications: Awaited<ReturnType<typeof buildServer>>[] = [];

function createDependencies(): ApiDependencies {
  const env = loadApiEnvironment({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379/0",
    API_HOST: "127.0.0.1",
    API_PORT: "4000",
    WEB_ORIGIN: "http://localhost:3000",
    COOKIE_SECURE: "false",
    SESSION_TTL_DAYS: "30",
    METRICS_TOKEN: "integration-metrics-token",
    WEBHOOK_SIGNING_SECRET: "integration-webhook-secret-with-32-characters",
    S3_ENDPOINT: "http://localhost:4566",
    S3_REGION: "eu-west-1",
    S3_BUCKET: "integration-screenshots",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
    S3_FORCE_PATH_STYLE: "true",
  });

  return {
    env,
    database: {
      pool: { query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }) },
      db: {},
      close: vi.fn(),
    },
    queues: {
      connection: { status: "ready", ping: vi.fn().mockResolvedValue("PONG"), connect: vi.fn() },
    },
    screenshots: { assertReady: vi.fn().mockResolvedValue(undefined) },
  } as unknown as ApiDependencies;
}

async function createApplication() {
  const application = await buildServer(createDependencies());
  applications.push(application);
  return application;
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map((application) => application.close()));
});

describe("API server integration", () => {
  it("reports liveness and dependency readiness", async () => {
    const application = await createApplication();

    const live = await application.inject({ method: "GET", url: "/api/health" });
    const ready = await application.inject({ method: "GET", url: "/api/ready" });

    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok", service: "changelens-api", version: "0.1.0" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({
      status: "ready",
      checks: { database: "ok", redis: "ok", storage: "ok" },
    });
  });

  it("returns consistent security errors and headers", async () => {
    const application = await createApplication();

    const csrf = await application.inject({ method: "POST", url: "/api/auth/logout" });
    const missing = await application.inject({ method: "GET", url: "/api/does-not-exist" });

    expect(csrf.statusCode).toBe(403);
    expect(csrf.json().error.code).toBe("CSRF_VALIDATION_FAILED");
    expect(csrf.headers["x-content-type-options"]).toBe("nosniff");
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    expect(missing.json().error.requestId).toEqual(expect.any(String));
  });

  it("protects operational metrics with a bearer token", async () => {
    const application = await createApplication();

    const denied = await application.inject({ method: "GET", url: "/api/metrics" });
    const allowed = await application.inject({
      method: "GET",
      url: "/api/metrics",
      headers: { authorization: "Bearer integration-metrics-token" },
    });

    expect(denied.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toContain("changelens_http_request_duration_seconds");
  });
});
