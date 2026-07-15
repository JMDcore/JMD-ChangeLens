import { describe, expect, it } from "vitest";

import { buildChangeSet, canonicalize } from "../diff.js";

describe("canonicalize", () => {
  it("produces stable object ordering without changing array order", () => {
    expect(canonicalize({ b: 2, a: ["x", "y"] })).toBe('{"a":["x","y"],"b":2}');
    expect(canonicalize({ a: ["x", "y"], b: 2 })).toBe(canonicalize({ b: 2, a: ["x", "y"] }));
  });
});

describe("buildChangeSet", () => {
  it("classifies additions, removals and value changes", () => {
    const changeSet = buildChangeSet(
      { title: "Keyboard", price: 99, availability: true },
      { title: "Keyboard Pro", price: 99, link: "https://example.com/product" },
    );

    expect(changeSet).toMatchObject({ hasChanges: true, changeCount: 3, added: 1, removed: 1, changed: 1 });
    expect(changeSet.entries).toEqual([
      { field: "availability", kind: "removed", before: true },
      { field: "link", kind: "added", after: "https://example.com/product" },
      { field: "title", kind: "changed", before: "Keyboard", after: "Keyboard Pro" },
    ]);
  });

  it("reports no changes for equivalent output", () => {
    const changeSet = buildChangeSet({ price: 42, title: "Same" }, { title: "Same", price: 42 });
    expect(changeSet).toEqual({ hasChanges: false, changeCount: 0, added: 0, removed: 0, changed: 0, entries: [] });
  });
});
