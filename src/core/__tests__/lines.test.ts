import { describe, it, expect } from "vitest";
import { splitLines, joinLines, detectEol, hasFinalNewline } from "../lines";

describe("lines", () => {
  it("splitLines drops the trailing newline's empty line", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("a\nb")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
  });

  it("splitLines keeps interior blank lines", () => {
    expect(splitLines("a\n\nb")).toEqual(["a", "", "b"]);
  });

  it("detectEol", () => {
    expect(detectEol("a\r\nb")).toBe("crlf");
    expect(detectEol("a\nb")).toBe("lf");
    expect(detectEol("noeol")).toBe("lf");
  });

  it("hasFinalNewline", () => {
    expect(hasFinalNewline("a\n")).toBe(true);
    expect(hasFinalNewline("a\r\n")).toBe(true);
    expect(hasFinalNewline("a")).toBe(false);
    expect(hasFinalNewline("")).toBe(false);
  });

  it("join round-trips lf and crlf with final newline", () => {
    expect(joinLines(["a", "b"], "lf", true)).toBe("a\nb\n");
    expect(joinLines(["a", "b"], "lf", false)).toBe("a\nb");
    expect(joinLines(["a", "b"], "crlf", true)).toBe("a\r\nb\r\n");
  });
});
