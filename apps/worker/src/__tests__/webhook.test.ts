import { describe, expect, it } from "vitest";

import { buildWebhookSignature } from "../processors/webhook.js";

describe("webhook signatures", () => {
  it("produces a stable SHA-256 HMAC header", () => {
    expect(buildWebhookSignature('{"event":"monitor.changed"}', "test-secret")).toBe(
      "sha256=28b2bcddba3a004ed11a20af1f4a6aacc24a52589ee3fc8b2a109b056c18fea7",
    );
  });
});
