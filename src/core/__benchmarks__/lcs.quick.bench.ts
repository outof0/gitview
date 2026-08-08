/**
 * Fast LCS benchmarks for local dev and CI (~seconds, not minutes).
 * Run: pnpm run bench:lcs
 */
import { bench, describe } from "vitest";
import { diffLines } from "../lcs";
import { benchLines } from "./helpers";

const QUICK_BENCH = { time: 750, iterations: 25 };

describe("lcs diffLines (quick)", () => {
  bench(
    "1k equal lines",
    () => {
      const a = benchLines(1_000);
      diffLines(a, a);
    },
    QUICK_BENCH,
  );

  bench(
    "5k equal lines",
    () => {
      const a = benchLines(5_000);
      diffLines(a, a);
    },
    QUICK_BENCH,
  );

  bench(
    "1k lines with periodic edits",
    () => {
      diffLines(benchLines(1_000), benchLines(1_000, 17));
    },
    QUICK_BENCH,
  );
});