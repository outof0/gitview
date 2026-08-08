import { describe, it, expect } from "vitest";
import { tokenizeLine, syntaxClass } from "../syntax";

describe("tokenizeLine", () => {
  it("tags keywords", () => {
    const tokens = tokenizeLine("const x = 1");
    const kw = tokens.find((t) => t.type === "keyword");
    expect(kw?.value).toBe("const");
  });

  it("tags double- and single-quoted strings", () => {
    expect(
      tokenizeLine('a = "hello"').some(
        (t) => t.type === "string" && t.value === '"hello"',
      ),
    ).toBe(true);
    expect(
      tokenizeLine("a = 'hi'").some(
        (t) => t.type === "string" && t.value === "'hi'",
      ),
    ).toBe(true);
  });

  it("tags line comments", () => {
    const tokens = tokenizeLine("// a comment");
    expect(tokens[0]!.type).toBe("comment");
    expect(tokens[0]!.value).toBe("// a comment");
  });

  it("does not treat a keyword substring as a keyword", () => {
    // 'constant' should not be flagged because of the \b boundary.
    const tokens = tokenizeLine("constant");
    expect(tokens.some((t) => t.type === "keyword")).toBe(false);
  });

  it("round-trips the original text", () => {
    const line = "export function f() { return 42; } // ok";
    expect(
      tokenizeLine(line)
        .map((t) => t.value)
        .join(""),
    ).toBe(line);
  });

  it("returns an empty token list for an empty line", () => {
    expect(tokenizeLine("")).toEqual([]);
  });

  it("merges adjacent plain tokens and keeps operators separate", () => {
    const tokens = tokenizeLine("x + y");
    expect(tokens.map((t) => t.type)).toEqual(["plain", "operator", "plain"]);
    expect(tokens.map((t) => t.value).join("")).toBe("x + y");
  });

  it("tags YAML keys as properties", () => {
    const tokens = tokenizeLine("workflow:", "yaml");
    expect(tokens.map((t) => t.type)).toEqual(["property", "operator"]);
    expect(tokens.map((t) => t.value).join("")).toBe("workflow:");
  });
});

describe("syntaxClass", () => {
  it("maps token types to CSS classes", () => {
    expect(syntaxClass("keyword")).toBe("syntax-keyword");
    expect(syntaxClass("property")).toBe("syntax-property");
    expect(syntaxClass("string")).toBe("syntax-string");
    expect(syntaxClass("comment")).toBe("syntax-comment");
    expect(syntaxClass("plain")).toBeUndefined();
  });
});
