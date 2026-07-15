import { describe, expect, it } from "vitest";

import { createOpaqueToken, keyedHash, safeEqual, sha256 } from "../lib/crypto.js";

describe("API cryptographic helpers", () => {
  it("creates URL-safe high-entropy opaque tokens", () => {
    const token = createOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(createOpaqueToken()).not.toBe(token);
  });

  it("hashes sessions and private metadata deterministically", () => {
    expect(sha256("session")).toHaveLength(64);
    expect(keyedHash("127.0.0.1", "secret")).toHaveLength(64);
    expect(keyedHash("127.0.0.1", "secret")).not.toBe(keyedHash("127.0.0.1", "other"));
  });

  it("compares CSRF values without accepting missing or different-length input", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "different")).toBe(false);
    expect(safeEqual(undefined, "same")).toBe(false);
  });
});
