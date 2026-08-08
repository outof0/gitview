/**
 * Stress LCS benchmarks — opt-in only (high memory / long runtime).
 * Run locally before algorithm changes: pnpm run bench:lcs:stress
 *
 * Not run in CI. These cases exercise the linear-space path at the line cap.
 */
import { bench, describe } from "vitest";
import { MAX_DIFF_LINES, diffLines } from "../lcs";
import { benchLines } from "./helpers";

const STRESS_BENCH = { time: 20_000, iterations: 5 };

describe("lcs diffLines (stress)", () => {
  bench(
    "10k equal lines",
    () => {
      const a = benchLines(10_000);
      diffLines(a, a);
    },
    STRESS_BENCH,
  );

  bench(
    "near line cap with edits",
    () => {
      const size = MAX_DIFF_LINES - 500;
      diffLines(benchLines(size), benchLines(size, 23));
    },
    STRESS_BENCH,
  );
});
