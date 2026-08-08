import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { resolveRepoRelativePath } from "../repoPath";

const join = (a: string, b: string) => `${a}/${b}`;

describe("resolveRepoRelativePath", () => {
  it("resolves a valid repo-relative path", () => {
    const result = resolveRepoRelativePath("/repo", "src/app.ts", join);
    expect(result).toEqual({
      ok: true,
      relativePath: "src/app.ts",
      absolutePath: path.resolve("/repo", "src/app.ts"),
    });
  });

  it("rejects empty paths", () => {
    expect(resolveRepoRelativePath("/repo", "", join)).toMatchObject({
      ok: false,
      code: "INVALID_PATH",
    });
  });

  it("rejects absolute paths", () => {
    expect(resolveRepoRelativePath("/repo", "/etc/passwd", join)).toMatchObject(
      {
        ok: false,
        code: "INVALID_PATH",
      },
    );
  });

  it("rejects parent traversal segments", () => {
    expect(resolveRepoRelativePath("/repo", "../outside", join)).toMatchObject({
      ok: false,
      code: "INVALID_PATH",
    });
    expect(
      resolveRepoRelativePath("/repo", "src/../../outside", join),
    ).toMatchObject({
      ok: false,
      code: "INVALID_PATH",
    });
  });

  it("rejects Windows-style absolute paths", () => {
    expect(resolveRepoRelativePath("/repo", "\\windows\\path", join)).toMatchObject(
      {
        ok: false,
        code: "INVALID_PATH",
      },
    );
  });

  it("normalizes Windows-style separators to forward slashes", () => {
    const result = resolveRepoRelativePath("/repo", "src\\app.ts", join);
    expect(result).toEqual({
      ok: true,
      relativePath: "src/app.ts",
      absolutePath: path.resolve("/repo", "src/app.ts"),
    });
  });

  it("normalizes leading current-directory segments", () => {
    const result = resolveRepoRelativePath("/repo", "./src/app.ts", join);
    expect(result).toEqual({
      ok: true,
      relativePath: "src/app.ts",
      absolutePath: path.resolve("/repo", "src/app.ts"),
    });
  });
});
