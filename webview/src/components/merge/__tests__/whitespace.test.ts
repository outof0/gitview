import { describe, it, expect } from "vitest";
import {
  linesEqualUnderPolicy,
  normalizeLineForCompare,
} from "../whitespace";

describe("whitespace comparison", () => {
  it("doNotIgnore treats trailing whitespace as different", () => {
    expect(linesEqualUnderPolicy("a  ", "a", "doNotIgnore")).toBe(false);
  });

  it("ignoreWhitespaces treats whitespace-only differences as equal", () => {
    expect(linesEqualUnderPolicy("a  ", "a", "ignoreWhitespaces")).toBe(true);
    expect(linesEqualUnderPolicy("a\tb", "ab", "ignoreWhitespaces")).toBe(true);
  });

  it("trimWhitespaces ignores leading and trailing whitespace only", () => {
    expect(normalizeLineForCompare("  a  ", "trimWhitespaces")).toBe("a");
    expect(linesEqualUnderPolicy("  a  ", "a", "trimWhitespaces")).toBe(true);
    expect(linesEqualUnderPolicy("a b", "ab", "trimWhitespaces")).toBe(false);
  });
});