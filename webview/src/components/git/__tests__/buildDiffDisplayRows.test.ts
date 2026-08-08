import { describe, it, expect } from "vitest";
import { buildDiffDisplayRows } from "../buildDiffDisplayRows";

describe("buildDiffDisplayRows", () => {
  it("aligns equal, removed, and added lines for split view", () => {
    const rows = buildDiffDisplayRows("a\nold\nb", "a\nnew\nb");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      leftText: "a",
      rightText: "a",
      leftHighlight: "none",
      rightHighlight: "none",
    });
    expect(rows[1]).toMatchObject({
      leftText: "old",
      rightText: "new",
      leftHighlight: "changed",
      rightHighlight: "changed",
    });
  });

  it("treats whitespace-only changes as equal when ignoring whitespaces", () => {
    const rows = buildDiffDisplayRows("line  ", "line", {
      whitespacePolicy: "ignoreWhitespaces",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      leftHighlight: "none",
      rightHighlight: "none",
    });
  });
});
