import { describe, expect, it } from "vitest";
import {
  countBlameAnnotations,
  groupBlameBlocks,
} from "../groupBlameBlocks";

const line = (
  n: number,
  sha: string,
  text = "",
): {
  lineNumber: number;
  sha: string;
  shortSha: string;
  author: string;
  authorTime: number;
  summary: string;
  text: string;
} => ({
  lineNumber: n,
  sha,
  shortSha: sha.slice(0, 7),
  author: "Author",
  authorTime: 1_700_000_000,
  summary: "msg",
  text,
});

describe("groupBlameBlocks", () => {
  it("merges consecutive lines with the same SHA", () => {
    const sha = "a".repeat(40);
    const blocks = groupBlameBlocks([
      line(1, sha, "one"),
      line(2, sha, "two"),
      line(3, sha, "three"),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.lines).toHaveLength(3);
    expect(blocks[0]!.anchor.lineNumber).toBe(1);
  });

  it("starts a new block when SHA changes", () => {
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    const blocks = groupBlameBlocks([
      line(1, a),
      line(2, a),
      line(3, b),
      line(4, b),
      line(5, b),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.lines).toHaveLength(2);
    expect(blocks[1]!.lines).toHaveLength(3);
    expect(countBlameAnnotations(blocks.flatMap((b) => b.lines))).toBe(2);
  });
});