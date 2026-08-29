import { describe, expect, it } from "vitest";
import { assertSafeGitOperand, isSafeGitOperand } from "../gitOperand";

describe("Git operands", () => {
  it("accepts refs, remote names, and paths passed as operands", () => {
    for (const value of ["main", "origin/main", "HEAD~1", "release/v1.0.0"]) {
      expect(isSafeGitOperand(value)).toBe(true);
      expect(() => assertSafeGitOperand(value, "ref")).not.toThrow();
    }
  });

  it("rejects empty, option-like, and control-character operands", () => {
    for (const value of [
      "",
      "--upload-pack=helper",
      "-D",
      "main\n--force",
      "a\0b",
    ]) {
      expect(isSafeGitOperand(value)).toBe(false);
    }
    expect(() => assertSafeGitOperand("--force", "branch name")).toThrow(
      "Invalid branch name.",
    );
  });
});
