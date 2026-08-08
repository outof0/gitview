import { describe, expect, it } from "vitest";
import type { DiffDisplayRow } from "../../components/git/buildDiffDisplayRows";
import { groupDiffHunks } from "../groupDiffHunks";

function row(
  leftHighlight: DiffDisplayRow["leftHighlight"] = "none",
  rightHighlight: DiffDisplayRow["rightHighlight"] = "none",
): DiffDisplayRow {
  return {
    leftNum: 1,
    rightNum: 1,
    leftText: "a",
    rightText: "a",
    leftHighlight,
    rightHighlight,
  };
}

describe("groupDiffHunks", () => {
  it("groups contiguous changed rows into hunks", () => {
    const rows = [
      row(),
      row("removed", "none"),
      row("removed", "none"),
      row(),
      row("none", "added"),
    ];
    const hunks = groupDiffHunks(rows);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toEqual({ id: 0, startRow: 1, endRow: 2 });
    expect(hunks[1]).toEqual({ id: 1, startRow: 4, endRow: 4 });
  });
});