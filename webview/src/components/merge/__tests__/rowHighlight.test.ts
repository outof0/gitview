import { describe, it, expect } from "vitest";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import { buildBlockRows, type BlockRows } from "../rows";
import {
  centerLineNeedsHighlight,
  lineHasChange,
  monacoLineDecorationClass,
  rowTypeClass,
  stripeTypeClass,
  shouldWordHighlight,
} from "../rowHighlight";

function makeDoc(base: string, ours: string, theirs: string) {
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

function mockRow(
  overrides: Partial<BlockRows> & Pick<BlockRows, "left">,
): BlockRows {
  return {
    blockId: "b0",
    kind: "conflict",
    status: "unresolved",
    changeType: "conflict",
    navigable: true,
    isConflict: true,
    resolved: false,
    resultStart: 0,
    resultEnd: 1,
    centerText: "",
    blameLeft: "",
    blameRight: "",
    baseLines: ["line1", "line2"],
    center: [],
    right: [],
    ...overrides,
  };
}

describe("lineHasChange", () => {
  it("does not flag lines that still match base within the same block", () => {
    const row = mockRow({
      left: [
        { text: "line1", lineNo: 1, origin: "ours" },
        { text: "ours2", lineNo: 2, origin: "ours" },
      ],
    });
    expect(lineHasChange("left", row, row.left[0]!, 0)).toBe(false);
    expect(lineHasChange("left", row, row.left[1]!, 1)).toBe(true);
  });

  it("does not flag filler alignment rows", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nextra\nc\n");
    const row = buildBlockRows(doc).find((r) => r.isConflict)!;
    const filler = row.left.find((c) => c.origin === "filler")!;
    const fillerIdx = row.left.indexOf(filler);
    expect(lineHasChange("left", row, filler, fillerIdx)).toBe(false);
  });

  it("flags only the conflicting line in a typical 3-way split", () => {
    const doc = makeDoc("line1\nline2\n", "line1\nours2\n", "line1\ntheirs2\n");
    const row = buildBlockRows(doc).find((r) => r.isConflict)!;
    expect(row.baseLines).toEqual(["line2"]);
    expect(lineHasChange("left", row, row.left[0]!, 0)).toBe(true);
  });
});

describe("rowTypeClass", () => {
  it("returns empty in words mode (no line background)", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nB\nc\n", "a\nb\nc\n");
    const row = buildBlockRows(doc).find((r) => r.changeType === "modified")!;
    expect(rowTypeClass("left", row, row.left[0]!, "words", 0)).toBe("");
  });

  it("highlights only changed lines in lines mode", () => {
    const row = mockRow({
      left: [
        { text: "line1", lineNo: 1, origin: "ours" },
        { text: "ours2", lineNo: 2, origin: "ours" },
      ],
    });
    expect(rowTypeClass("left", row, row.left[0]!, "lines", 0)).toBe("");
    expect(rowTypeClass("left", row, row.left[1]!, "lines", 1)).toBe(
      "nx-conflict",
    );
  });

  it("returns empty when highlighting is disabled", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nB\nc\n", "a\nb\nc\n");
    const row = buildBlockRows(doc).find((r) => r.changeType === "modified")!;
    expect(rowTypeClass("left", row, row.left[0]!, "none", 0)).toBe("");
  });
});

describe("stripeTypeClass", () => {
  it("shows stripe on changed lines in words mode", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nB\nc\n", "a\nb\nc\n");
    const row = buildBlockRows(doc).find((r) => r.changeType === "modified")!;
    expect(stripeTypeClass("left", row, row.left[0]!, "words", 0)).toBe(
      "nx-modified",
    );
  });
});

describe("centerLineNeedsHighlight", () => {
  it("highlights center lines that differ from base", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nB\nc\n", "a\nb\nc\n");
    const row = buildBlockRows(doc).find((r) => r.changeType === "modified")!;
    expect(centerLineNeedsHighlight(row, 0, "B")).toBe(true);
    expect(monacoLineDecorationClass(row, 0, "B")).toBe("nx-monaco-modified");
  });

  it("highlights conflict region in center even when result still shows base", () => {
    const doc = makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const row = buildBlockRows(doc).find((r) => r.isConflict)!;
    expect(centerLineNeedsHighlight(row, 0, "b")).toBe(true);
    expect(monacoLineDecorationClass(row, 0, "b")).toBe("nx-monaco-conflict");
  });

  it("does not highlight shared context before competing EOF inserts", () => {
    const base = [
      "# Test Conflict Repo",
      "",
      "This is a test repository for gitview.",
      "",
      "## Features",
      "- Feature A",
      "- Feature B",
    ].join("\n");
    const doc = makeDoc(
      base,
      `${base}\n- Feature D (different new feature)`,
      `${base}\n- Feature C (new)`,
    );
    const rows = buildBlockRows(doc);
    const context = rows[0]!;
    const conflict = rows[1]!;

    expect(context.changeType).toBe("unchanged");
    expect(conflict.isConflict).toBe(true);
    expect(centerLineNeedsHighlight(context, 0, "# Test Conflict Repo")).toBe(
      false,
    );
    expect(monacoLineDecorationClass(conflict, 0, "")).toBe(
      "nx-monaco-conflict",
    );
  });
});

describe("whitespace policy", () => {
  it("ignores trailing whitespace when policy is ignoreWhitespaces", () => {
    const row = mockRow({
      left: [{ text: "ours2  ", lineNo: 1, origin: "ours" }],
      baseLines: ["ours2"],
    });
    expect(
      lineHasChange("left", row, row.left[0]!, 0, {
        whitespacePolicy: "ignoreWhitespaces",
      }),
    ).toBe(false);
    expect(
      lineHasChange("left", row, row.left[0]!, 0, {
        whitespacePolicy: "doNotIgnore",
      }),
    ).toBe(true);
  });
});

describe("compare mode", () => {
  const conflictDoc = () =>
    buildBlockRows(makeDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n")).find(
      (r) => r.isConflict,
    )!;

  it("localRepo highlights both sides when local differs from repository", () => {
    const row = conflictDoc();
    const ctx = { compareMode: "localRepo" as const };
    expect(lineHasChange("left", row, row.left[0]!, 0, ctx)).toBe(true);
    expect(lineHasChange("right", row, row.right[0]!, 0, ctx)).toBe(true);
    expect(centerLineNeedsHighlight(row, 0, "b", ctx)).toBe(false);
  });

  it("localBase highlights only left against base, not center or repository", () => {
    // GitView behavior this protects: Local vs Base is strictly Local ↔ Base.
    const row = conflictDoc();
    const ctx = { compareMode: "localBase" as const };
    expect(lineHasChange("left", row, row.left[0]!, 0, ctx)).toBe(true);
    expect(lineHasChange("right", row, row.right[0]!, 0, ctx)).toBe(false);
    expect(centerLineNeedsHighlight(row, 0, "b", ctx)).toBe(false);
    expect(centerLineNeedsHighlight(row, 0, "ours", ctx)).toBe(false);
    expect(centerLineNeedsHighlight(row, 0, "manual-result", ctx)).toBe(false);
  });

  it("repoBase highlights only the repository pane", () => {
    const row = conflictDoc();
    const ctx = { compareMode: "repoBase" as const };
    expect(lineHasChange("left", row, row.left[0]!, 0, ctx)).toBe(false);
    expect(lineHasChange("right", row, row.right[0]!, 0, ctx)).toBe(true);
    expect(centerLineNeedsHighlight(row, 0, "b", ctx)).toBe(false);
  });

  it("localMiddle highlights left against center result", () => {
    const row = conflictDoc();
    const ctx = { compareMode: "localMiddle" as const };
    expect(lineHasChange("left", row, row.left[0]!, 0, ctx)).toBe(true);
    expect(lineHasChange("right", row, row.right[0]!, 0, ctx)).toBe(false);
    expect(centerLineNeedsHighlight(row, 0, "b", ctx)).toBe(false);
  });

  it("repoMiddle highlights right against center result", () => {
    const row = conflictDoc();
    const ctx = { compareMode: "repoMiddle" as const };
    expect(lineHasChange("left", row, row.left[0]!, 0, ctx)).toBe(false);
    expect(lineHasChange("right", row, row.right[0]!, 0, ctx)).toBe(true);
    expect(centerLineNeedsHighlight(row, 0, "b", ctx)).toBe(false);
  });

  it("default mode uses legacy conflict-region center highlighting", () => {
    const row = conflictDoc();
    expect(centerLineNeedsHighlight(row, 0, "b")).toBe(true);
    expect(monacoLineDecorationClass(row, 0, "b")).toBe("nx-monaco-conflict");
  });
});

describe("shouldWordHighlight", () => {
  it("enables word diff only on changed lines in words mode", () => {
    const row = mockRow({
      left: [
        { text: "line1", lineNo: 1, origin: "ours" },
        { text: "ours2", lineNo: 2, origin: "ours" },
      ],
    });
    expect(shouldWordHighlight("left", row, row.left[0]!, "words", 0)).toBe(
      false,
    );
    expect(shouldWordHighlight("left", row, row.left[1]!, "words", 1)).toBe(
      true,
    );
    expect(shouldWordHighlight("left", row, row.left[1]!, "lines", 1)).toBe(
      false,
    );
  });
});
