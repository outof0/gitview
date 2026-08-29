import { describe, expect, it } from "vitest";
import {
  extractPatchFileTexts,
  parsePatchFileSummaries,
} from "../patchDocument";

const PATCH = [
  "diff --git a/added.txt b/added.txt",
  "new file mode 100644",
  "index 0000000..e69de29",
  "--- /dev/null",
  "+++ b/added.txt",
  "@@ -0,0 +1,2 @@",
  "+hello",
  "+world",
  "diff --git a/deleted.txt b/deleted.txt",
  "deleted file mode 100644",
  "index e69de29..0000000",
  "--- a/deleted.txt",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-goodbye",
  "diff --git a/nested/modified.ts b/nested/modified.ts",
  "index aaa..bbb 100644",
  "--- a/nested/modified.ts",
  "+++ b/nested/modified.ts",
  "@@ -1,3 +1,3 @@",
  " const a = 1;",
  "-const b = 2;",
  "+const b = 20;",
  " const c = 3;",
].join("\n");

describe("parsePatchFileSummaries", () => {
  it("derives per-file status from ---/+++ headers in patch order", () => {
    expect(parsePatchFileSummaries(PATCH)).toEqual([
      { path: "added.txt", status: "A" },
      { path: "deleted.txt", status: "D" },
      { path: "nested/modified.ts", status: "M" },
    ]);
  });

  it("returns an empty list for an empty patch", () => {
    expect(parsePatchFileSummaries("")).toEqual([]);
  });

  it("decodes quoted Git paths including tabs and UTF-8 octal bytes", () => {
    const patch = [
      'diff --git "a/name\\t\\303\\251.txt" "b/name\\t\\303\\251.txt"',
      '--- "a/name\\t\\303\\251.txt"',
      '+++ "b/name\\t\\303\\251.txt"',
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");

    expect(parsePatchFileSummaries(patch)).toEqual([
      { path: "name\té.txt", status: "M" },
    ]);
    expect(extractPatchFileTexts(patch, "name\té.txt")).toEqual({
      before: "old",
      after: "new",
    });
  });
});

describe("extractPatchFileTexts", () => {
  it("rebuilds after-only text for an added file", () => {
    expect(extractPatchFileTexts(PATCH, "added.txt")).toEqual({
      before: null,
      after: "hello\nworld",
    });
  });

  it("rebuilds before-only text for a deleted file", () => {
    expect(extractPatchFileTexts(PATCH, "deleted.txt")).toEqual({
      before: "goodbye",
      after: null,
    });
  });

  it("rebuilds both sides with context for a modified file", () => {
    expect(extractPatchFileTexts(PATCH, "nested/modified.ts")).toEqual({
      before: "const a = 1;\nconst b = 2;\nconst c = 3;",
      after: "const a = 1;\nconst b = 20;\nconst c = 3;",
    });
  });

  it("returns null when the patch has no section for the path", () => {
    expect(extractPatchFileTexts(PATCH, "missing.ts")).toBeNull();
  });

  it("ignores the no-newline-at-eof marker", () => {
    const patch = [
      "diff --git a/x.txt b/x.txt",
      "--- a/x.txt",
      "+++ b/x.txt",
      "@@ -1 +1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
      "\\ No newline at end of file",
    ].join("\n");
    expect(extractPatchFileTexts(patch, "x.txt")).toEqual({
      before: "old",
      after: "new",
    });
  });
});
