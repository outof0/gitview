import { describe, it, expect } from "vitest";
import {
  canonicalRepoRelativePath,
  isValidRepoRelativeFilePath,
  isValidRepoRelativePath,
} from "../blameRefs";

describe("isValidRepoRelativeFilePath", () => {
  it("accepts concrete file paths", () => {
    expect(isValidRepoRelativeFilePath("src/app.ts")).toBe(true);
    expect(isValidRepoRelativeFilePath("src\\app.ts")).toBe(true);
  });

  it("rejects repo root and directory paths", () => {
    expect(isValidRepoRelativeFilePath(".")).toBe(false);
    expect(isValidRepoRelativeFilePath("./")).toBe(false);
    expect(isValidRepoRelativeFilePath("src/")).toBe(false);
    expect(isValidRepoRelativeFilePath("src\\")).toBe(false);
  });
});

describe("canonicalRepoRelativePath", () => {
  it("normalizes Windows separators", () => {
    expect(canonicalRepoRelativePath("src\\app.ts")).toBe("src/app.ts");
  });

  it("returns null for invalid paths", () => {
    expect(canonicalRepoRelativePath("../outside")).toBeNull();
    expect(isValidRepoRelativePath("../outside")).toBe(false);
  });
});