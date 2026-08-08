import * as path from "path";
import { describe, expect, it } from "vitest";
import { validateRepoRelativePaths } from "../validatePaths";

const repoRoot = path.resolve("/workspace/repo");

describe("validateRepoRelativePaths", () => {
  it("accepts posix paths inside the repository", () => {
    const result = validateRepoRelativePaths(repoRoot, ["src/app.ts"]);
    expect(result).toEqual({ ok: true, paths: ["src/app.ts"] });
  });

  it("normalizes windows-style separators to forward slashes", () => {
    const result = validateRepoRelativePaths(repoRoot, ["src\\lib\\util.ts"]);
    expect(result).toEqual({ ok: true, paths: ["src/lib/util.ts"] });
  });

  it("rejects traversal segments on posix and windows paths", () => {
    for (const candidate of ["../secret.txt", "..\\secret.txt", "src/../../etc/passwd"]) {
      const result = validateRepoRelativePaths(repoRoot, [candidate]);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects absolute paths", () => {
    const result = validateRepoRelativePaths(repoRoot, ["/etc/passwd"]);
    expect(result.ok).toBe(false);
  });

  it("deduplicates repeated paths", () => {
    const result = validateRepoRelativePaths(repoRoot, [
      "src/a.ts",
      "src/a.ts",
    ]);
    expect(result).toEqual({ ok: true, paths: ["src/a.ts"] });
  });

  it("requires a non-empty path array", () => {
    expect(validateRepoRelativePaths(repoRoot, []).ok).toBe(false);
    expect(validateRepoRelativePaths(repoRoot, undefined).ok).toBe(false);
  });
});