import { describe, expect, it } from "vitest";

import { buildScreenshotKey } from "../index.js";

describe("buildScreenshotKey", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";
  const executionId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  it("scopes screenshots to the owning user and execution", () => {
    expect(buildScreenshotKey(userId, executionId)).toBe(`users/${userId}/executions/${executionId}/page.jpg`);
  });

  it.each([
    ["invalid user id", "../other-user", executionId],
    ["invalid execution id", userId, "../../secrets"],
  ])("rejects %s", (_label, candidateUserId, candidateExecutionId) => {
    expect(() => buildScreenshotKey(candidateUserId, candidateExecutionId)).toThrow(
      "Screenshot keys require UUID identifiers",
    );
  });
});
