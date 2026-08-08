import { describe, it, expect } from "vitest";
import { createGitService } from "../gitService";
import { blamePorcelain, makeFakeGit } from "./gitService.testHelpers";

describe("GitService blameFile", () => {
  it("returns parsed blame lines for a valid ref", async () => {
    const { service } = makeFakeGit({
      "diff --numstat -- src/app.ts": {
        stdout: "1\t0\tsrc/app.ts\n",
        stderr: "",
      },
      "blame --line-porcelain -M -C HEAD -- src/app.ts": {
        stdout: blamePorcelain,
        stderr: "",
      },
    });
    const result = await service.blameFile("/repo", "HEAD", "src/app.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]!.author).toBe("John Doe");
    }
  });

  it("returns BINARY_FILE when isBinaryFile detects binary", async () => {
    const { service } = makeFakeGit({
      "diff --numstat -- image.png": {
        stdout: "-\t-\timage.png\n",
        stderr: "",
      },
    });
    const result = await service.blameFile("/repo", "HEAD", "image.png");
    expect(result).toEqual({
      ok: false,
      code: "BINARY_FILE",
      message: "Git blame is not available for binary files.",
    });
  });

  it("returns FILE_NOT_AT_REF when git blame fails for missing path", async () => {
    const execGit = (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "diff --numstat -- missing.ts") {
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      return Promise.reject(
        new Error("fatal: no such path missing.ts in HEAD"),
      );
    };
    const svc = createGitService({ execGit });
    const result = await svc.blameFile("/repo", "HEAD", "missing.ts");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_NOT_AT_REF");
    }
  });

  it("blameFileForAnnotate falls back to working tree when HEAD has no path", async () => {
    const execGit = (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "diff --numstat -- new.ts") {
        return Promise.resolve({ stdout: "1\t0\tnew.ts\n", stderr: "" });
      }
      if (key === "blame --line-porcelain -M -C HEAD -- new.ts") {
        return Promise.reject(
          new Error("fatal: no such path new.ts in HEAD"),
        );
      }
      if (key === "blame --line-porcelain -M -C -- new.ts") {
        return Promise.resolve({
          stdout: blamePorcelain.replace("src/app.ts", "new.ts"),
          stderr: "",
        });
      }
      return Promise.reject(new Error(`unexpected: ${key}`));
    };
    const svc = createGitService({ execGit });
    const result = await svc.blameFileForAnnotate("/repo", "new.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines).toHaveLength(1);
    }
  });

  it("caches blame results for the same path and ref", async () => {
    const { service, calls } = makeFakeGit({
      "diff --numstat -- src/app.ts": {
        stdout: "1\t0\tsrc/app.ts\n",
        stderr: "",
      },
      "blame --line-porcelain -M -C HEAD -- src/app.ts": {
        stdout: blamePorcelain,
        stderr: "",
      },
    });
    await service.blameFile("/repo", "HEAD", "src/app.ts");
    await service.blameFile("/repo", "HEAD", "src/app.ts");
    const blameCalls = calls.filter((c) => c.args[0] === "blame");
    expect(blameCalls).toHaveLength(1);
  });

  it("blameFileForSide resolves MERGE_HEAD for theirs", async () => {
    const execGit = (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "rev-parse --verify HEAD") {
        return Promise.resolve({ stdout: "abc\n", stderr: "" });
      }
      if (key === "rev-parse --verify MERGE_HEAD") {
        return Promise.resolve({ stdout: "def\n", stderr: "" });
      }
      if (key === "diff --numstat -- src/app.ts") {
        return Promise.resolve({ stdout: "1\t0\tsrc/app.ts\n", stderr: "" });
      }
      if (key === "blame --line-porcelain -M -C MERGE_HEAD -- src/app.ts") {
        return Promise.resolve({ stdout: blamePorcelain, stderr: "" });
      }
      return Promise.reject(new Error(`Unexpected: ${key}`));
    };
    const svc = createGitService({ execGit });
    const result = await svc.blameFileForSide(
      "/repo",
      "src/app.ts",
      "theirs",
    );
    expect(result.ok).toBe(true);
  });

  it("blameFileForSide returns REF_NOT_FOUND when MERGE_HEAD is missing", async () => {
    const execGit = (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "rev-parse --verify MERGE_HEAD") {
        return Promise.reject(new Error("MERGE_HEAD not found"));
      }
      return Promise.reject(new Error(`Unexpected: ${key}`));
    };
    const svc = createGitService({ execGit });
    const result = await svc.blameFileForSide(
      "/repo",
      "src/app.ts",
      "theirs",
    );
    expect(result).toMatchObject({ ok: false, code: "REF_NOT_FOUND" });
  });
});