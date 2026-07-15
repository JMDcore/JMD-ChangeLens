import { describe, expect, it } from "vitest";

import { scheduleIntervalMs } from "@changelens/contracts";

import { schedulerId } from "../index.js";

describe("queue scheduling", () => {
  it("uses stable scheduler identifiers", () => {
    expect(schedulerId("8dc78c36-0df4-4c0c-a591-cbf50db09a5e")).toBe("monitor:8dc78c36-0df4-4c0c-a591-cbf50db09a5e");
  });

  it("maps product presets to exact intervals", () => {
    expect(scheduleIntervalMs.manual).toBeNull();
    expect(scheduleIntervalMs.every_15m).toBe(900_000);
    expect(scheduleIntervalMs.hourly).toBe(3_600_000);
    expect(scheduleIntervalMs.every_6h).toBe(21_600_000);
    expect(scheduleIntervalMs.daily).toBe(86_400_000);
  });
});
