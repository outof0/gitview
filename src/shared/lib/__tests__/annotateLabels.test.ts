import { describe, expect, it } from "vitest";
import {
  baseContextLabel,
  blockAnnotateLabel,
  formatBlameDetailsLabel,
} from "../annotateLabels";
import type { BlameLine } from "../../../types/blame";

const NOW = 1_719_000_000_000;

function line(
  n: number,
  sha: string,
  author: string,
  authorTime: number,
): BlameLine {
  return {
    lineNumber: n,
    sha: sha.padEnd(40, "0").slice(0, 40),
    shortSha: sha.slice(0, 7),
    author,
    authorEmail: "a@b.c",
    authorTime,
    summary: "msg",
  };
}

describe("formatBlameDetailsLabel", () => {
  it("formats blame Details column label", () => {
    const label = formatBlameDetailsLabel(
      line(1, "e9a2b5f", "John Doe", 1_718_992_800),
      NOW,
    );
    expect(label).toMatch(/^John Doe, .+ \| Commit: e9a2b5f$/);
  });
});

describe("blockAnnotateLabel", () => {
  it("uses the dominant commit within a line range", () => {
    const lines = [
      line(1, "aaa", "Alice", 1),
      line(2, "aaa", "Alice", 1),
      line(3, "bbb", "Bob", 2),
    ];
    const label = blockAnnotateLabel(lines, 1, 3, "fallback", NOW);
    expect(label).toContain("Alice");
    expect(label).toContain("Commit: aaa");
  });

  it("returns fallback when range is empty", () => {
    expect(blockAnnotateLabel([], 1, 5, baseContextLabel("main"), NOW)).toBe(
      "base (main)",
    );
  });
});
