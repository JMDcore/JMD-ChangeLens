import { describe, expect, it } from "vitest";

import { coerceExtractedValue, normalizeWhitespace, parseNumericValue } from "../values.js";

describe("extracted value normalization", () => {
  it("normalizes whitespace", () => {
    expect(normalizeWhitespace("  Only\n  four\tleft ")).toBe("Only four left");
  });

  it.each([
    ["€1.299,95", 1299.95],
    ["$1,299.95", 1299.95],
    ["£ 51.77", 51.77],
    ["1 299", 1299],
    ["-12,5%", -12.5],
  ])("parses locale-aware numeric input %s", (input, expected) => {
    expect(parseNumericValue(input)).toBe(expected);
  });

  it("resolves relative links against the final URL", () => {
    expect(coerceExtractedValue("../offer", "url", "https://example.com/products/item")).toBe(
      "https://example.com/offer",
    );
  });
});
