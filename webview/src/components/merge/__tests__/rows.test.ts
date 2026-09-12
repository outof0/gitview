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

  it("counts a genuine conflict with non-overlapping word edits as simple", () => {
    const doc = makeDoc(
      "This is a simple conflict that can be resolved.\n",
      "Below is a simple conflict that can be resolved.\n",
      "This is a simple conflict that can be resolved automatically.\n",
    );
    const counts = countChanges(doc);
    expect(counts.unresolvedSimpleConflicts).toBe(1);
    expect(counts.unresolvedNonConflicting).toBe(0);
  });

  it("does not count overlapping edits as simple", () => {
    const doc = makeDoc(
      "The color is blue.\n",
      "The color is red.\n",
      "The color is green.\n",
    );
    expect(countChanges(doc).unresolvedSimpleConflicts).toBe(0);
  });

  it("does not count partially accepted or manually resolved conflicts", () => {
    const doc = makeDoc(
      "This is a simple conflict that can be resolved.\n",
      "Below is a simple conflict that can be resolved.\n",
      "This is a simple conflict that can be resolved automatically.\n",
    );
    const conflict = doc.blocks.find((block) => block.kind === "conflict")!;
    const partiallyAccepted = {
      ...doc,
      blocks: doc.blocks.map((block) =>
        block.id === conflict.id
          ? {
              ...block,
              metadata: {
                ...block.metadata,
                conflict: {
                  ours: "accepted" as const,
                  theirs: "pending" as const,
                  acceptedOrder: ["ours" as const],
                },
              },
            }
          : block,
      ),
    };
    expect(countChanges(partiallyAccepted).unresolvedSimpleConflicts).toBe(0);

    const manual = {
      ...doc,
      blocks: doc.blocks.map((block) =>
        block.id === conflict.id
          ? {
              ...block,
              status: "manual" as const,
              metadata: { ...block.metadata, hasManualEdit: true },
            }
          : block,
      ),
    };
    expect(countChanges(manual).unresolvedSimpleConflicts).toBe(0);
  });

  it("does not offer Magic Merge for special or incomplete documents", () => {
    const doc = makeDoc(
      "This is a simple conflict that can be resolved.\n",
      "Below is a simple conflict that can be resolved.\n",
      "This is a simple conflict that can be resolved automatically.\n",
    );
    expect(
      countChanges({ ...doc, special: "add_add" }).unresolvedSimpleConflicts,
    ).toBe(0);
    expect(countChanges({ ...doc, base: null }).unresolvedSimpleConflicts).toBe(
      0,
    );
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
