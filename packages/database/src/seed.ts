import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";

import { createDatabase } from "./index.js";
import { changes, executions, extractionFields, monitors, users } from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const client = createDatabase(connectionString);
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  lamp: "20000000-0000-4000-8000-000000000001",
  keyboard: "20000000-0000-4000-8000-000000000002",
  status: "20000000-0000-4000-8000-000000000003",
  lampPrevious: "30000000-0000-4000-8000-000000000001",
  lampLatest: "30000000-0000-4000-8000-000000000002",
  keyboardLatest: "30000000-0000-4000-8000-000000000003",
  statusFailed: "30000000-0000-4000-8000-000000000004",
};

const passwordHash = await hash("ChangeLensDemo!2026", {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
});

try {
  await client.db.transaction(async (transaction) => {
    await transaction
      .insert(users)
      .values({ id: ids.user, name: "José Miguel Díaz", email: "demo@changelens.dev", passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: "José Miguel Díaz", passwordHash, updatedAt: now },
      });

    const [demoUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "demo@changelens.dev"));
    if (!demoUser) throw new Error("Could not create the demo user");

    await transaction.delete(monitors).where(eq(monitors.userId, demoUser.id));

    await transaction.insert(monitors).values([
      {
        id: ids.lamp,
        userId: demoUser.id,
        name: "Lumina desk lamp",
        url: "https://jmdcore.github.io/JMD-ChangeLens/demo/lumina-desk-lamp.html",
        hostname: "jmdcore.github.io",
        renderMode: "auto",
        schedule: "hourly",
        status: "changed",
        lastRunAt: ago(8),
        lastChangedAt: ago(8),
        nextRunAt: new Date(now.getTime() + 52 * 60_000),
      },
      {
        id: ids.keyboard,
        userId: demoUser.id,
        name: "Orbit mechanical keyboard",
        url: "https://jmdcore.github.io/JMD-ChangeLens/demo/orbit-keyboard.html",
        hostname: "jmdcore.github.io",
        renderMode: "browser",
        schedule: "every_6h",
        status: "healthy",
        lastRunAt: ago(34),
        nextRunAt: new Date(now.getTime() + 326 * 60_000),
      },
      {
        id: ids.status,
        userId: demoUser.id,
        name: "Atlas API status",
        url: "https://jmdcore.github.io/JMD-ChangeLens/demo/atlas-status.html",
        hostname: "jmdcore.github.io",
        renderMode: "static",
        schedule: "every_15m",
        status: "failing",
        lastRunAt: ago(3),
        nextRunAt: new Date(now.getTime() + 12 * 60_000),
        consecutiveFailures: 2,
      },
    ]);

    await transaction.insert(extractionFields).values([
      {
        monitorId: ids.lamp,
        key: "title",
        label: "Product",
        selector: "h1",
        valueType: "text",
        required: true,
        position: 0,
      },
      {
        monitorId: ids.lamp,
        key: "price",
        label: "Price",
        selector: "[data-price]",
        valueType: "currency",
        required: true,
        position: 1,
      },
      {
        monitorId: ids.lamp,
        key: "availability",
        label: "Availability",
        selector: "[data-stock]",
        valueType: "text",
        position: 2,
      },
      {
        monitorId: ids.keyboard,
        key: "title",
        label: "Product",
        selector: "h1",
        valueType: "text",
        required: true,
        position: 0,
      },
      {
        monitorId: ids.keyboard,
        key: "price",
        label: "Price",
        selector: ".product-price",
        valueType: "currency",
        required: true,
        position: 1,
      },
      {
        monitorId: ids.status,
        key: "status",
        label: "API status",
        selector: "[data-service='api'] .state",
        valueType: "text",
        required: true,
        position: 0,
      },
      {
        monitorId: ids.status,
        key: "latency",
        label: "Latency",
        selector: "[data-service='api'] .latency",
        valueType: "number",
        position: 1,
      },
    ]);

    await transaction.insert(executions).values([
      {
        id: ids.lampPrevious,
        monitorId: ids.lamp,
        userId: demoUser.id,
        trigger: "scheduled",
        status: "succeeded",
        renderer: "cheerio",
        output: { title: "Lumina desk lamp", price: 129, availability: "In stock" },
        normalizedHash: "13cf2c09375af46d0ec4c180986932eb072e8ec1e5cd4253fb2a6469956280c9",
        requestedAt: ago(68),
        startedAt: ago(68),
        finishedAt: ago(67.95),
        durationMs: 2_840,
        attempt: 1,
        httpStatus: 200,
        finalUrl: "https://jmdcore.github.io/JMD-ChangeLens/demo/lumina-desk-lamp.html",
      },
      {
        id: ids.lampLatest,
        monitorId: ids.lamp,
        userId: demoUser.id,
        trigger: "scheduled",
        status: "succeeded",
        renderer: "cheerio",
        output: { title: "Lumina desk lamp", price: 109, availability: "Only 4 left" },
        normalizedHash: "647d0fafef2ad64dbe71004bf84d8bca0c2dc75e7b5487cc00a84b79a6c62de8",
        requestedAt: ago(8),
        startedAt: ago(8),
        finishedAt: ago(7.94),
        durationMs: 3_120,
        attempt: 1,
        httpStatus: 200,
        finalUrl: "https://jmdcore.github.io/JMD-ChangeLens/demo/lumina-desk-lamp.html",
      },
      {
        id: ids.keyboardLatest,
        monitorId: ids.keyboard,
        userId: demoUser.id,
        trigger: "manual",
        status: "succeeded",
        renderer: "playwright",
        output: { title: "Orbit 75 mechanical keyboard", price: 184 },
        normalizedHash: "9e38bec3e205a9af8c4455f5f4cb27b4926f9d411618a36623f56ecaf3f19d6c",
        requestedAt: ago(34),
        startedAt: ago(34),
        finishedAt: ago(33.85),
        durationMs: 8_960,
        attempt: 1,
        httpStatus: 200,
        finalUrl: "https://jmdcore.github.io/JMD-ChangeLens/demo/orbit-keyboard.html",
      },
      {
        id: ids.statusFailed,
        monitorId: ids.status,
        userId: demoUser.id,
        trigger: "scheduled",
        status: "failed",
        requestedAt: ago(3),
        startedAt: ago(3),
        finishedAt: ago(2.5),
        durationMs: 30_000,
        attempt: 3,
        errorCode: "NAVIGATION_TIMEOUT",
        errorMessage: "Navigation exceeded the configured 30 second timeout.",
        logs: [
          { timestamp: ago(3).toISOString(), level: "info", message: "Domain policy lease acquired" },
          { timestamp: ago(2.5).toISOString(), level: "error", message: "Navigation timeout reached" },
        ],
      },
    ]);

    await transaction.insert(changes).values([
      {
        executionId: ids.lampPrevious,
        previousExecutionId: null,
        hasChanges: false,
        changeCount: 0,
        summary: { hasChanges: false, changeCount: 0, added: 0, removed: 0, changed: 0, entries: [] },
      },
      {
        executionId: ids.lampLatest,
        previousExecutionId: ids.lampPrevious,
        hasChanges: true,
        changeCount: 2,
        summary: {
          hasChanges: true,
          changeCount: 2,
          added: 0,
          removed: 0,
          changed: 2,
          entries: [
            { field: "availability", kind: "changed", before: "In stock", after: "Only 4 left" },
            { field: "price", kind: "changed", before: 129, after: 109 },
          ],
        },
      },
      {
        executionId: ids.keyboardLatest,
        previousExecutionId: null,
        hasChanges: false,
        changeCount: 0,
        summary: { hasChanges: false, changeCount: 0, added: 0, removed: 0, changed: 0, entries: [] },
      },
    ]);
  });

  console.info("ChangeLens demo data seeded. Login: demo@changelens.dev / ChangeLensDemo!2026");
} finally {
  await client.close();
}
