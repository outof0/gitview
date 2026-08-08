import { describe, expect, it } from "vitest";
import {
  MalformedConflictError,
  buildChangeBlocksFromMarkers,
} from "../markersEngine";
import { reflowResultRanges, serializeResult } from "../serialize";

describe("markersEngine", () => {
  it("builds unchanged + conflict blocks from markers", () => {
    const worktree =
      "before\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> main\nafter\n";
    const blocks = buildChangeBlocksFromMarkers(worktree);
    expect(blocks.map((b) => b.kind)).toEqual([
      "unchanged",
      "conflict",
      "unchanged",
    ]);
    const conflict = blocks[1]!;
    expect(conflict.oursText).toBe("ours");
    expect(conflict.theirsText).toBe("theirs");
    expect(conflict.changeIndex).toBe(0);
    expect(conflict.status).toBe("unresolved");
  });

  it("parses diff3 base section and serializes without markers", () => {
    const worktree =
      "ctx\n<<<<<<< HEAD\nours\n||||||| base\nbase-line\n=======\ntheirs\n>>>>>>> branch\n";
    const blocks = buildChangeBlocksFromMarkers(worktree);
    const conflict = blocks.find((b) => b.kind === "conflict");
    expect(conflict?.baseText).toBe("base-line");
    const out = serializeResult(reflowResultRanges(blocks), "lf", true);
    expect(out).toBe("ctx\nbase-line\n");
    expect(out).not.toMatch(/^<{7}/m);
  });

  it("handles multiple conflicts in order", () => {
    const worktree =
      "a\n<<<<<<< HEAD\n1\n=======\n2\n>>>>>>> x\nmid\n<<<<<<< HEAD\n3\n=======\n4\n>>>>>>> y\nb\n";
    const blocks = buildChangeBlocksFromMarkers(worktree);
    expect(blocks.filter((b) => b.kind === "conflict")).toHaveLength(2);
    expect(blocks.map((b) => b.kind)).toEqual([
      "unchanged",
      "conflict",
      "unchanged",
      "conflict",
      "unchanged",
    ]);
  });

  it("throws on malformed markers", () => {
    expect(() =>
      buildChangeBlocksFromMarkers("<<<<<<< HEAD\nonly start\n"),
    ).toThrow(MalformedConflictError);
  });
});