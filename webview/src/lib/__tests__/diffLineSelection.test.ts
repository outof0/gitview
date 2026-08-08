import { describe, expect, it } from "vitest";
import type { DiffDisplayRow } from "../../components/git/buildDiffDisplayRows";
import {
  lineSelectionKey,
  selectionFromRow,
  selectionsFromKeys,
} from "../diffLineSelection";

describe("diffLineSelection", () => {
  it("maps changed rows to old/new line selections", () => {
    const row: DiffDisplayRow = {
      leftNum: 4,
      rightNum: null,
      leftText: "old",
      rightText: "",
      leftHighlight: "removed",
      rightHighlight: "none",
    };
    expect(selectionFromRow("left", row)).toEqual({ side: "old", line: 4 });
    expect(selectionFromRow("right", row)).toBeNull();
  });

  it("round-trips selection keys", () => {
    const key = lineSelectionKey({ side: "new", line: 12 });
    expect(selectionsFromKeys([key])).toEqual([{ side: "new", line: 12 }]);
  });
});