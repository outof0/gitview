import { describe, expect, it } from "vitest";
import { diffLines } from "../lcs";
import { benchLines } from "../__benchmarks__/helpers";

/**
 * Soft perf regression guards (Vitest unit tests, not micro-benchmarks).
 * Thresholds are generous to avoid flaky CI — tighten when optimizing LCS.
 */
describe("lcs perf guards", () => {
  it("diffLines on 1k equal lines stays under 50ms", () => {
    const a = benchLines(1_000);
    const start = performance.now();
    diffLines(a, a);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("diffLines on 5k equal lines stays under 500ms", () => {
    const a = benchLines(5_000);
    const start = performance.now();
    diffLines(a, a);
    expect(performance.now() - start).toBeLessThan(500);
  });
});