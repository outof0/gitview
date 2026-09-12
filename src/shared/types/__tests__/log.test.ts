import { describe, expect, it } from "vitest";
import { logQueryFiltersEqual } from "../log";

describe("logQueryFiltersEqual", () => {
  it("ignores pagination offsets while comparing query filters", () => {
    expect(
      logQueryFiltersEqual(
        { range: "all", limit: 200, skip: 0 },
        { range: "all", limit: 200, skip: 200 },
      ),
    ).toBe(true);
  });

  it("treats missing and null-like values as equivalent", () => {
    expect(logQueryFiltersEqual({ branch: undefined }, {})).toBe(true);
    expect(logQueryFiltersEqual({ branch: null as never }, {})).toBe(true);
  });

  it("detects a real filter change", () => {
    expect(
      logQueryFiltersEqual({ branch: "main" }, { branch: "feature" }),
    ).toBe(false);
  });
});
