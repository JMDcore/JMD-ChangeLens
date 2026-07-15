import { describe, expect, it } from "vitest";

import { createMonitorSchema, registerSchema } from "../schemas.js";

const validMonitor = {
  name: "Product price",
  url: "https://example.com/product",
  fields: [
    {
      key: "price",
      label: "Price",
      selector: "[data-testid='price']",
      valueType: "currency",
      required: true,
      multiple: false,
    },
  ],
};

describe("monitor contracts", () => {
  it("applies safe defaults", () => {
    expect(createMonitorSchema.parse(validMonitor)).toMatchObject({
      renderMode: "auto",
      schedule: "manual",
      isActive: true,
      retentionDays: 30,
    });
  });

  it("rejects duplicate keys", () => {
    const parsed = createMonitorSchema.safeParse({
      ...validMonitor,
      fields: [validMonitor.fields[0], { ...validMonitor.fields[0], label: "Second price" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("auth contracts", () => {
  it("requires a meaningful password length", () => {
    expect(registerSchema.safeParse({ name: "José", email: "jose@example.com", password: "too-short" }).success).toBe(
      false,
    );
  });
});
