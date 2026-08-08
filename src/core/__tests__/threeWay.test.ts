import { describe, it, expect } from "vitest";
import { buildChangeBlocks } from "../threeWay";
import type { ChangeKind } from "../types";

// Helper: build blocks and return [kind, resultText] tuples for navigable + context.
function kinds(base: string, ours: string, theirs: string): ChangeKind[] {
  return buildChangeBlocks(base, ours, theirs).map((b) => b.kind);
}

function byId(base: string, ours: string, theirs: string) {
  return buildChangeBlocks(base, ours, theirs);
}

describe("buildChangeBlocks — classification", () => {
  it("all identical → single unchanged block", () => {
    const t = "a\nb\nc";
    expect(kinds(t, t, t)).toEqual(["unchanged"]);
  });

  it("ours-only change is non-conflicting", () => {
    const base = "a\nb\nc";
    const ours = "a\nB\nc";
    const theirs = "a\nb\nc";
    const ks = kinds(base, ours, theirs);
    expect(ks).toContain("ours_only");
    expect(ks).not.toContain("conflict");
  });

  it("theirs-only change is non-conflicting", () => {
    const base = "a\nb\nc";
    const ours = "a\nb\nc";
    const theirs = "a\nb\nC";
    const ks = kinds(base, ours, theirs);
    expect(ks).toContain("theirs_only");
    expect(ks).not.toContain("conflict");
  });

  it("both sides make the SAME change → both_same", () => {
    const base = "a\nb\nc";
    const ours = "a\nX\nc";
    const theirs = "a\nX\nc";
    const ks = kinds(base, ours, theirs);
    expect(ks).toContain("both_same");
    expect(ks).not.toContain("conflict");
  });

  it("both sides change the same line differently → conflict", () => {
    const base = "a\nb\nc";
    const ours = "a\nX\nc";
    const theirs = "a\nY\nc";
    const ks = kinds(base, ours, theirs);
    expect(ks).toContain("conflict");
  });

  it("non-overlapping changes on different lines → two non-conflicting blocks", () => {
    const base = "a\nb\nc\nd";
    const ours = "A\nb\nc\nd"; // change line 1
    const theirs = "a\nb\nc\nD"; // change line 4
    const ks = kinds(base, ours, theirs);
    expect(ks).toContain("ours_only");
    expect(ks).toContain("theirs_only");
    expect(ks).not.toContain("conflict");
  });
});

describe("buildChangeBlocks — initial result + status", () => {
  it("conflict starts unresolved with the base text in the result", () => {
    const blocks = byId("a\nb\nc", "a\nX\nc", "a\nY\nc");
    const c = blocks.find((b) => b.kind === "conflict")!;
    expect(c.status).toBe("unresolved");
    expect(c.resultText).toBe("b");
    expect(c.metadata.conflict).toEqual({
      ours: "pending",
      theirs: "pending",
      acceptedOrder: [],
    });
  });

  it("ours_only auto-applies ours and is resolved", () => {
    const blocks = byId("a\nb\nc", "a\nB\nc", "a\nb\nc");
    const o = blocks.find((b) => b.kind === "ours_only")!;
    expect(o.status).toBe("resolved");
    expect(o.resultText).toBe("B");
  });

  it("both_same auto-resolves to the shared text", () => {
    const blocks = byId("a\nb\nc", "a\nX\nc", "a\nX\nc");
    const bs = blocks.find((b) => b.kind === "both_same")!;
    expect(bs.status).toBe("resolved");
    expect(bs.resultText).toBe("X");
  });
});

describe("buildChangeBlocks — edge cases", () => {
  it("no base (add/add) with different content → conflict", () => {
    const ks = kinds("", "hello", "world");
    expect(ks).toContain("conflict");
  });

  it("no base (add/add) with identical content → both_same", () => {
    const ks = kinds("", "same", "same");
    expect(ks).toContain("both_same");
  });

  it("pure insertion on ours → ours_only", () => {
    const base = "a\nc";
    const ours = "a\nb\nc"; // inserted b
    const theirs = "a\nc";
    const ks = kinds(base, ours, theirs);
    expect(ks).toContain("ours_only");
    expect(ks).not.toContain("conflict");
  });

  it("navigable blocks get sequential changeIndex; unchanged get -1", () => {
    const blocks = byId("a\nb\nc\nd", "A\nb\nc\nd", "a\nb\nc\nD");
    const navigable = blocks.filter((b) => b.changeIndex >= 0);
    const idxs = navigable.map((b) => b.changeIndex).sort((a, b) => a - b);
    expect(idxs).toEqual([0, 1]);
    for (const b of blocks) {
      if (b.kind === "unchanged") {
        expect(b.changeIndex).toBe(-1);
      }
    }
  });
});
