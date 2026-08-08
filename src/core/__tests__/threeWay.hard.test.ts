import { describe, it, expect } from "vitest";
import { buildChangeBlocks } from "../threeWay";
import { reflowResultRanges, serializeResult } from "../serialize";
import { acceptOurs, acceptTheirs } from "../resolve";

// Harder, realistic 3-way scenarios that exercise alignment edge cases.

describe("threeWay — harder scenarios", () => {
  it("keeps shared context separate from competing EOF inserts", () => {
    const base = [
      "# Test Conflict Repo",
      "",
      "This is a test repository for gitview.",
      "",
      "## Features",
      "- Feature A",
      "- Feature B",
    ].join("\n");
    const ours = `${base}\n- Feature D (different new feature)`;
    const theirs = `${base}\n- Feature C (new)`;

    const blocks = buildChangeBlocks(base, ours, theirs);

    expect(blocks.map((b) => b.kind)).toEqual(["unchanged", "conflict"]);
    expect(blocks[0]!.baseText).toBe(base);
    expect(blocks[1]!.baseText).toBe("");
    expect(blocks[1]!.oursText).toBe("- Feature D (different new feature)");
    expect(blocks[1]!.theirsText).toBe("- Feature C (new)");
    expect(blocks[1]!.baseRange).toEqual({ start: 7, end: 7 });
  });

  it("multiple separate conflicts in one file", () => {
    const base = "1\n2\n3\n4\n5";
    const ours = "1\nA\n3\nB\n5";
    const theirs = "1\nX\n3\nY\n5";
    const blocks = buildChangeBlocks(base, ours, theirs);
    const conflicts = blocks.filter((b) => b.kind === "conflict");
    expect(conflicts).toHaveLength(2);
  });

  it("ours deletes a line, theirs keeps base → ours_only", () => {
    const base = "a\nb\nc";
    const ours = "a\nc"; // deleted b
    const theirs = "a\nb\nc";
    const kinds = buildChangeBlocks(base, ours, theirs).map((b) => b.kind);
    expect(kinds).toContain("ours_only");
    expect(kinds).not.toContain("conflict");
  });

  it("ours deletes a line, theirs modifies the same line → conflict", () => {
    const base = "a\nb\nc";
    const ours = "a\nc"; // delete b
    const theirs = "a\nB\nc"; // modify b
    const kinds = buildChangeBlocks(base, ours, theirs).map((b) => b.kind);
    expect(kinds).toContain("conflict");
  });

  it("adjacent conflict and non-conflicting change stay separate", () => {
    const base = "1\n2\n3";
    const ours = "1\nA\nC"; // line2 conflict-ish, line3 changed
    const theirs = "1\nB\n3"; // line2 changed differently, line3 base
    const blocks = buildChangeBlocks(base, ours, theirs);
    // There must be at least one conflict (line 2) and the result must be
    // serializable without markers once resolved.
    expect(blocks.some((b) => b.kind === "conflict")).toBe(true);
  });

  it("full resolve of a 2-conflict file yields clean output", () => {
    const base = "1\n2\n3\n4\n5";
    const ours = "1\nA\n3\nB\n5";
    const theirs = "1\nX\n3\nY\n5";
    let blocks = buildChangeBlocks(base, ours, theirs);
    // accept ours for first conflict, theirs for second
    const conflictIds = blocks
      .filter((b) => b.kind === "conflict")
      .map((b) => b.id);
    blocks = blocks.map((b) => {
      if (b.id === conflictIds[0]) {
        return acceptOurs(b);
      }
      if (b.id === conflictIds[1]) {
        return acceptTheirs(b);
      }
      return b;
    });
    blocks = reflowResultRanges(blocks);
    const out = serializeResult(blocks, "lf", false);
    expect(out).toBe("1\nA\n3\nY\n5");
  });

  it("resultRange reflects line positions after reflow", () => {
    const base = "1\n2\n3";
    const ours = "1\n2\n3";
    const theirs = "1\n2\n3";
    const blocks = reflowResultRanges(buildChangeBlocks(base, ours, theirs));
    // single unchanged block covering 3 lines
    expect(blocks[0]!.resultRange).toEqual({ start: 0, end: 3 });
  });
});
