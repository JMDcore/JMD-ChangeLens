import { describe, expect, it } from "vitest";

import { executionsToCsv } from "../lib/csv.js";

describe("execution CSV export", () => {
  it("creates a stable union of fields and escapes complex values", () => {
    const csv = executionsToCsv([
      {
        id: "run-1",
        requestedAt: new Date("2026-07-15T12:00:00.000Z"),
        durationMs: 1250,
        output: { title: 'Desk lamp, "Pro"', tags: ["light", "desk"] },
      },
      {
        id: "run-2",
        requestedAt: new Date("2026-07-15T13:00:00.000Z"),
        durationMs: null,
        output: { title: "Desk lamp" },
      },
    ]);

    expect(csv.split("\n")[0]).toBe("execution_id,requested_at,duration_ms,tags,title");
    expect(csv).toContain('"[""light"",""desk""]"');
    expect(csv).toContain('"Desk lamp, ""Pro"""');
  });
});
