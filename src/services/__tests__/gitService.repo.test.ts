import { describe, it, expect } from "vitest";
import { createGitService, type GitServiceDeps } from "../gitService";
import { makeFakeGit } from "./gitService.testHelpers";

describe("GitService", () => {
  describe("findRepoRoot", () => {
    it("returns repo root when git succeeds", async () => {
      const { service } = makeFakeGit({
        "rev-parse --show-toplevel": { stdout: "/tmp/repo\n", stderr: "" },
      });
      const root = await service.findRepoRoot("/tmp/repo/src");
      expect(root).toBe("/tmp/repo");
    });

    it("returns null when not a git repo", async () => {
      const execGit: GitServiceDeps["execGit"] = () => {
        return Promise.reject(new Error("not a git repo"));
      };
      const svc = createGitService({ execGit });
      const root = await svc.findRepoRoot("/tmp/not-repo");
      expect(root).toBeNull();
    });
  });

  describe("getBranchInfo", () => {
    it("detects merge in progress", async () => {
      const { service } = makeFakeGit({
        "symbolic-ref --short HEAD": { stdout: "feature\n", stderr: "" },
        "rev-parse --verify MERGE_HEAD": {
          stdout: "abc123\n",
          stderr: "",
        },
      });
      const info = await service.getBranchInfo("/repo");
      expect(info.currentBranch).toBe("feature");
      expect(info.mergeInProgress).toBe(true);
      expect(info.operation).toBe("merge");
      expect(info.mergeHead).toBe("abc123");
    });

    it("detects rebase in progress", async () => {
      const execGit: GitServiceDeps["execGit"] = (_root, args) => {
        const key = args.join(" ");
        if (key === "symbolic-ref --short HEAD") {
          return Promise.resolve({ stdout: "feature\n", stderr: "" });
        }
        if (key === "rev-parse --verify MERGE_HEAD") {
          return Promise.reject(new Error("no MERGE_HEAD"));
        }
        if (key === "rev-parse --verify REBASE_HEAD") {
          return Promise.resolve({ stdout: "def456\n", stderr: "" });
        }
        return Promise.reject(new Error(`Unexpected: ${key}`));
      };
      const svc = createGitService({ execGit });
      const info = await svc.getBranchInfo("/repo");
      expect(info.operation).toBe("rebase");
      expect(info.rebaseInProgress).toBe(true);
    });

    it("detects detached HEAD", async () => {
      const execGit: GitServiceDeps["execGit"] = (_root, args) => {
        const key = args.join(" ");
        if (key === "symbolic-ref --short HEAD") {
          return Promise.reject(new Error("detached HEAD"));
        }
        if (key === "rev-parse --short HEAD") {
          return Promise.resolve({ stdout: "a1b2c3d\n", stderr: "" });
        }
        return Promise.reject(new Error(`Unexpected: ${key}`));
      };
      const svc = createGitService({ execGit });
      const info = await svc.getBranchInfo("/repo");
      expect(info.currentBranch).toBe("a1b2c3d");
      expect(info.operation).toBe("none");
    });
  });

  describe("listUnmergedFiles", () => {
    it("parses UU, AA, UD, DU stage codes", async () => {
      const output =
        "UU src/app.tsx\0AA package.json\0UD README.md\0DU src/old.ts\0";
      const { service } = makeFakeGit({
        "status --porcelain=v1 -z": { stdout: output, stderr: "" },
      });
      const files = await service.listUnmergedFiles("/repo");
      expect(files).toHaveLength(4);
      expect(files[0]).toEqual({
        relativePath: "src/app.tsx",
        stageCode: "UU",
        specialKind: "none",
      });
      expect(files[1]).toEqual({
        relativePath: "package.json",
        stageCode: "AA",
        specialKind: "add_add",
      });
      expect(files[2]).toEqual({
        relativePath: "README.md",
        stageCode: "UD",
        specialKind: "modify_delete",
      });
      expect(files[3]).toEqual({
        relativePath: "src/old.ts",
        stageCode: "DU",
        specialKind: "delete_modify",
      });
    });

    it("filters out non-unmerged files", async () => {
      const output =
        "UU src/app.tsx\0 M src/modified.ts\0?? src/untracked.ts\0";
      const { service } = makeFakeGit({
        "status --porcelain=v1 -z": { stdout: output, stderr: "" },
      });
      const files = await service.listUnmergedFiles("/repo");
      expect(files).toHaveLength(1);
      expect(files[0]!.relativePath).toBe("src/app.tsx");
    });
  });

  describe("readStage", () => {
    it("returns content for valid stage", async () => {
      const { service } = makeFakeGit({
        "show :1:src/app.tsx": { stdout: "base content", stderr: "" },
      });
      const content = await service.readStage("/repo", "src/app.tsx", 1);
      expect(content).toBe("base content");
    });

    it("returns null for missing stage", async () => {
      const execGit: GitServiceDeps["execGit"] = () => {
        return Promise.reject(new Error("fatal: path does not have a commit"));
      };
      const svc = createGitService({ execGit });
      const content = await svc.readStage("/repo", "src/app.tsx", 1);
      expect(content).toBeNull();
    });
  });
});