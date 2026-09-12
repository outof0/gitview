import { describe, expect, it } from "vitest";
import { buildDiffNavigationHunks, monacoDiffWashClass } from "../diffNavigation";

describe("buildDiffNavigationHunks", () => {
  it("coalesces adjacent replace operations into one navigable hunk", () => {
    expect(
      buildDiffNavigationHunks("one\ntwo\nthree", "one\nTWO\nTHREE"),
    ).toEqual([
      {
        kind: "changed",
        originalStartLine: 2,
        originalEndLine: 3,
        modifiedStartLine: 2,
        modifiedEndLine: 3,
      },
    ]);
  });

  it("keeps separated changes as separate targets", () => {
    expect(
      buildDiffNavigationHunks("a\nb\nc\nd", "a\nB\nc\nD"),
    ).toEqual([
      {
        kind: "changed",
        originalStartLine: 2,
        originalEndLine: 2,
        modifiedStartLine: 2,
        modifiedEndLine: 2,
      },
      {
        kind: "changed",
        originalStartLine: 4,
        originalEndLine: 4,
        modifiedStartLine: 4,
        modifiedEndLine: 4,
      },
    ]);
  });

  it("anchors insertions and deletions to a visible line", () => {
    expect(buildDiffNavigationHunks("b", "a\nb\nc")).toEqual([
      {
        kind: "added",
        originalStartLine: 1,
        originalEndLine: 1,
        modifiedStartLine: 1,
        modifiedEndLine: 1,
      },
      {
        kind: "added",
        originalStartLine: 1,
        originalEndLine: 1,
        modifiedStartLine: 3,
        modifiedEndLine: 3,
      },
    ]);
  });

  it("returns no targets for identical content", () => {
    expect(buildDiffNavigationHunks("same", "same")).toEqual([]);
  });
});

describe("monacoDiffWashClass", () => {
  it("maps a replace to removed on the original and added on the modified", () => {
    expect(monacoDiffWashClass("changed", "original")).toBe(
      "monaco-diff-removed",
    );
    expect(monacoDiffWashClass("changed", "modified")).toBe(
      "monaco-diff-added",
    );
  });

  it("does not wash the opposite side of a pure insert or delete", () => {
    expect(monacoDiffWashClass("added", "original")).toBeNull();
    expect(monacoDiffWashClass("added", "modified")).toBe("monaco-diff-added");
    expect(monacoDiffWashClass("removed", "original")).toBe(
      "monaco-diff-removed",
    );
    expect(monacoDiffWashClass("removed", "modified")).toBeNull();
  });
});
