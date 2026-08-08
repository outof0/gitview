import { describe, it, expect } from "vitest";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import {
  buildBlockRows,
  classifyChangeType,
  countChanges,
  searchMatchBlockIds,
} from "../rows";
import type { MergeDocument } from "../../../../../src/core/types";

function makeDoc(base: string, ours: string, theirs: string): MergeDocument {
  return buildMergeDocument({
    repoRoot: "/r",
    relativePath: "f.ts",
    absolutePath: "/r/f.ts",
    base,
    ours,
    theirs,
    worktree: ours,
  });
}

describe("buildBlockRows", () => {
  it("produces one BlockRows per block in document order", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nB\nc\n", "a\nb\nc\n");
    const rows = buildBlockRows(doc);
    expect(rows.length).toBe(doc.blocks.length);
    expect(rows.map((r) => r.blockId)).toEqual(doc.blocks.map((b) => b.id));
  });

  it("aligns left/center/right cells to the same row count per block", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    for (const row of buildBlockRows(doc)) {
      expect(row.left.length).toBe(row.center.length);
      expect(row.center.length).toBe(row.right.length);
    }
  });

  it("shows the base text in the center for an unresolved conflict", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const rows = buildBlockRows(doc);
    const conflict = rows.find((r) => r.isConflict);
    expect(conflict).toBeDefined();
    const centerText = conflict!.center
      .map((c) => c.text)
      .filter((t): t is string => t !== null);
    expect(centerText).toEqual(["b"]);
    expect(conflict!.resolved).toBe(false);
  });

  it("does not expose a resolved conflict as an active conflict issue", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    const resolved = {
      ...doc,
      blocks: doc.blocks.map((b) =>
        b.id === conflict.id
          ? {
              ...b,
              status: "accepted_both" as const,
              resultText: "ours\ntheirs",
            }
          : b,
      ),
    };

    const row = buildBlockRows(resolved).find(
      (r) => r.blockId === conflict.id,
    )!;
    expect(row.resolved).toBe(true);
    expect(row.isConflict).toBe(false);
    expect(row.changeType).toBe("added");
  });

  it("assigns ascending 1-based line numbers per pane, skipping fillers", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nB\nc\n", "a\nb\nc\n");
    const rows = buildBlockRows(doc);
    const leftNos = rows
      .flatMap((r) => r.left)
      .map((c) => c.lineNo)
      .filter((n): n is number => n !== null);
    // Strictly increasing line numbers, starting at 1.
    expect(leftNos[0]).toBe(1);
    for (let i = 1; i < leftNos.length; i++) {
      expect(leftNos[i]).toBeGreaterThan(leftNos[i - 1]!);
    }
  });
});

describe("classifyChangeType", () => {
  it("classifies an added block (base empty) as 'added'", () => {
    const doc = makeDoc("a\nc\n", "a\nNEW\nc\n", "a\nc\n");
    const added = doc.blocks.find((b) => b.kind === "ours_only");
    expect(added).toBeDefined();
    expect(classifyChangeType(added!)).toBe("added");
  });

  it("classifies a deletion (side empty) as 'deleted'", () => {
    const doc = makeDoc("a\nGONE\nc\n", "a\nc\n", "a\nGONE\nc\n");
    const deleted = doc.blocks.find((b) => b.kind === "ours_only");
    expect(deleted).toBeDefined();
    expect(classifyChangeType(deleted!)).toBe("deleted");
  });

  it("classifies a both-sides-incompatible change as 'conflict'", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nX\nc\n", "a\nY\nc\n");
    const conflict = doc.blocks.find((b) => b.kind === "conflict");
    expect(conflict).toBeDefined();
    expect(classifyChangeType(conflict!)).toBe("conflict");
  });
});

describe("countChanges", () => {
  it("counts total navigable changes, conflicts, and unresolved remaining", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const counts = countChanges(doc);
    expect(counts.conflicts).toBe(1);
    expect(counts.remaining).toBe(1);
    expect(counts.totalChanges).toBeGreaterThanOrEqual(1);
  });

  it("counts both_same only in simple conflicts, not non-conflicting apply", () => {
    const doc = makeDoc("top\nmid\n", "top\nboth\n", "top\nboth\n");
    const blocks = doc.blocks.map((b) =>
      b.kind === "both_same" ? { ...b, status: "unresolved" as const } : b,
    );
    const counts = countChanges({ ...doc, blocks });
    expect(counts.unresolvedSimpleConflicts).toBeGreaterThanOrEqual(1);
    expect(counts.unresolvedNonConflicting).toBe(0);
  });
});

describe("buildBlockRows blame", () => {
  it("derives per-side stub annotations from the branch labels", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const rows = buildBlockRows(doc);
    const conflict = rows.find((r) => r.isConflict)!;
    expect(conflict.blameLeft).toContain(doc.oursLabel);
    expect(conflict.blameRight).toContain(doc.theirsLabel);
  });

  it("uses git blame lines when provided", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const blameOurs = [
      {
        lineNumber: 2,
        sha: "abc1234567890abcdef1234567890abcdef1234",
        shortSha: "abc1234",
        author: "Jane Doe",
        authorEmail: "j@example.com",
        authorTime: 1_700_000_000,
        summary: "Fix conflict",
      },
    ];
    const rows = buildBlockRows(doc, { blameOurs });
    const conflict = rows.find((r) => r.isConflict)!;
    expect(conflict.blameLeft).toContain("Jane Doe");
    expect(conflict.blameLeft).toContain("abc1234");
  });
});

describe("searchMatchBlockIds", () => {
  it("matches center text case-insensitively", () => {
    const doc = makeDoc("a\nFindMe\nc\n", "a\nFindMe\nc\n", "a\nFindMe\nc\n");
    const rows = buildBlockRows(doc);
    expect(searchMatchBlockIds(rows, "findme").length).toBeGreaterThan(0);
  });

  it("ignores queries shorter than 2 characters", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const rows = buildBlockRows(doc);
    expect(searchMatchBlockIds(rows, "a")).toEqual([]);
  });
});
