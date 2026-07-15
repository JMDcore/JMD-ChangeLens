import { describe, expect, it } from "vitest";

import { computeDomainDelay } from "../domain-policy.js";

describe("per-domain rate policy", () => {
  it("does not delay the first request", () => {
    expect(computeDomainDelay(null, 10_000, 2_500)).toBe(0);
  });

  it("returns only the remaining delay", () => {
    expect(computeDomainDelay(10_000, 11_000, 2_500)).toBe(1_500);
    expect(computeDomainDelay(10_000, 13_000, 2_500)).toBe(0);
  });
});
