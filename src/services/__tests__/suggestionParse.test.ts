import { describe, expect, it } from "vitest";
import { parseSuggestionFromBody } from "../review/suggestionParse";

describe("suggestionParse", () => {
  it("extracts suggestion block from review comment body", () => {
    const body = "Use this instead:\n```suggestion\nconst x = 1;\n```";
    expect(parseSuggestionFromBody(body)).toBe("const x = 1;");
  });

  it("returns null when no suggestion block exists", () => {
    expect(parseSuggestionFromBody("Looks good.")).toBeNull();
  });
});