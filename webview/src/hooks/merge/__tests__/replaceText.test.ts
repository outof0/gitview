import { describe, it, expect } from "vitest";
import { replaceAllIn, replaceFirst } from "../replaceText";

describe("merge replaceText", () => {
  it("replaceFirst replaces a single case-insensitive match", () => {
    expect(replaceFirst("Hello WORLD", "world", "there")).toBe("Hello there");
  });

  it("replaceAllIn replaces every match", () => {
    expect(replaceAllIn("foo bar foo", "foo", "baz")).toBe("baz bar baz");
  });
});