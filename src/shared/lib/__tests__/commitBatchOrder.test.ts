import { describe, expect, it } from "vitest";
import { orderShasOldestFirst } from "../commitBatchOrder";

describe("orderShasOldestFirst", () => {
  // Displayed history, newest first: c3 is newest, c1 is oldest.
  const log = ["c3", "c2", "c1"];

  it("orders a newest-first click selection oldest-first", () => {
    expect(orderShasOldestFirst(["c3", "c1"], log)).toEqual(["c1", "c3"]);
  });

  it("keeps an oldest-first click selection as is", () => {
    expect(orderShasOldestFirst(["c1", "c3"], log)).toEqual(["c1", "c3"]);
  });

  it("orders three commits by history regardless of click order", () => {
    expect(orderShasOldestFirst(["c2", "c3", "c1"], log)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("dedupes repeated clicks", () => {
    expect(orderShasOldestFirst(["c3", "c1", "c3"], log)).toEqual(["c1", "c3"]);
  });

  it("appends commits outside the current view in click order", () => {
    expect(orderShasOldestFirst(["c3", "other", "c1"], log)).toEqual([
      "c1",
      "c3",
      "other",
    ]);
  });

  it("passes through an empty selection", () => {
    expect(orderShasOldestFirst([], log)).toEqual([]);
  });
});
