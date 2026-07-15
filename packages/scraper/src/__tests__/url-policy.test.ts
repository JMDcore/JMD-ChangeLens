import { describe, expect, it } from "vitest";

import { ScrapeError } from "../errors.js";
import { assertPublicHttpUrl, isBlockedIpAddress, normalizePublicUrl, type HostResolver } from "../url-policy.js";

const resolvesTo =
  (...addresses: string[]): HostResolver =>
  async () =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

describe("URL input policy", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "http://user:pass@example.com",
    "http://example.com:8080",
    "http://localhost",
    "http://api.internal/secret",
    "http://metadata.google.internal/computeMetadata/v1/",
  ])("blocks unsafe URL %s", (input) => {
    expect(() => normalizePublicUrl(input)).toThrow(ScrapeError);
  });

  it("normalizes fragments without rewriting the source path", () => {
    expect(normalizePublicUrl("https://example.com/product?q=one#section").toString()).toBe(
      "https://example.com/product?q=one",
    );
  });
});

describe("IP range policy", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(false);
  });

  it("rejects a hostname if any DNS answer is private", async () => {
    await expect(
      assertPublicHttpUrl("https://example.com", resolvesTo("93.184.216.34", "10.0.0.4")),
    ).rejects.toMatchObject({
      code: "IP_RANGE_BLOCKED",
      blocked: true,
    });
  });

  it("accepts a hostname resolving only to public addresses", async () => {
    await expect(assertPublicHttpUrl("https://example.com", resolvesTo("93.184.216.34"))).resolves.toBeInstanceOf(URL);
  });
});
