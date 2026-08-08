import { describe, expect, it } from "vitest";
import { mapBlameAnchors } from "../mapBlameAnchors";

type Src = { id: string; text?: string };

function src(id: string, text: string): Src {
  return { id, text };
}

describe("mapBlameAnchors", () => {
  it("keeps 1:1 mapping when nothing changed", () => {
    const original = [src("a", "line1"), src("b", "line2"), src("c", "line3")];
    const mapped = mapBlameAnchors(original, ["line1", "line2", "line3"]);
    expect(mapped.map((m) => m?.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves blame below an insertion (the neo bug)", () => {
    const original = [
      src("a", "function foo() {"),
      src("b", "  return 1;"),
      src("c", "}"),
    ];
    // User inserts two lines between foo and return
    const current = [
      "function foo() {",
      "  // new",
      "  const x = 0;",
      "  return 1;",
      "}",
    ];
    const mapped = mapBlameAnchors(original, current);
    expect(mapped.map((m) => m?.id ?? null)).toEqual([
      "a",
      null,
      null,
      "b",
      "c",
    ]);
  });

  it("preserves blame above a deletion", () => {
    const original = [
      src("a", "line1"),
      src("b", "line2"),
      src("c", "line3"),
      src("d", "line4"),
    ];
    const current = ["line1", "line3", "line4"];
    const mapped = mapBlameAnchors(original, current);
    expect(mapped.map((m) => m?.id)).toEqual(["a", "c", "d"]);
  });

  it("clears blame when a line is edited", () => {
    const original = [src("a", "const x = 1;"), src("b", "const y = 2;")];
    const current = ["const x = 99;", "const y = 2;"];
    const mapped = mapBlameAnchors(original, current);
    expect(mapped.map((m) => m?.id ?? null)).toEqual([null, "b"]);
  });

  it("handles insert at top without losing lower anchors", () => {
    const original = [src("a", "A"), src("b", "B"), src("c", "C")];
    const current = ["NEW", "A", "B", "C"];
    const mapped = mapBlameAnchors(original, current);
    expect(mapped.map((m) => m?.id ?? null)).toEqual([null, "a", "b", "c"]);
  });

  it("handles insert at bottom", () => {
    const original = [src("a", "A"), src("b", "B")];
    const current = ["A", "B", "NEW"];
    const mapped = mapBlameAnchors(original, current);
    expect(mapped.map((m) => m?.id ?? null)).toEqual(["a", "b", null]);
  });

  it("order-preserves when duplicate lines exist", () => {
    const original = [
      src("a", "}"),
      src("b", "  body"),
      src("c", "}"),
    ];
    // Insert between the two identical "}" lines
    const current = ["}", "  body", "  extra", "}"];
    const mapped = mapBlameAnchors(original, current);
    expect(mapped[0]?.id).toBe("a");
    expect(mapped[1]?.id).toBe("b");
    expect(mapped[2]).toBeNull();
    expect(mapped[3]?.id).toBe("c");
  });

  it("returns all null when fully rewritten", () => {
    const original = [src("a", "old1"), src("b", "old2")];
    const mapped = mapBlameAnchors(original, ["new1", "new2"]);
    expect(mapped).toEqual([null, null]);
  });
});
