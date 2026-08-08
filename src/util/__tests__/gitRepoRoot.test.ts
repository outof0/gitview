import { describe, expect, it, vi } from "vitest";
import * as path from "node:path";
import {
  findRepoRootForTarget,
  workspaceRelativeToRepoRelative,
} from "../gitRepoRoot";

describe("findRepoRootForTarget", () => {
  it("prefers the clicked file path over the workspace root", async () => {
    const workspaceRoot = path.join(
      path.parse(process.cwd()).root,
      "Users",
      "dev",
      "monorepo",
    );
    const repoRoot = path.join(workspaceRoot, "gitview");
    const targetPath = path.join(repoRoot, "README.md");
    const findRepoRoot = vi.fn(async (startPath: string) => {
      if (startPath === targetPath) {
        return repoRoot;
      }
      return null;
    });

    const root = await findRepoRootForTarget(
      { findRepoRoot },
      workspaceRoot,
      "gitview/README.md",
    );

    expect(root).toBe(repoRoot);
    expect(findRepoRoot).toHaveBeenCalledWith(targetPath);
    expect(findRepoRoot).not.toHaveBeenCalledWith(workspaceRoot);
  });

  it("falls back to the workspace root when the target path is the repo root", async () => {
    const workspaceRoot = path.join(
      path.parse(process.cwd()).root,
      "Users",
      "dev",
      "app",
    );
    const findRepoRoot = vi.fn(async (startPath: string) => {
      if (startPath === workspaceRoot) {
        return workspaceRoot;
      }
      return null;
    });

    const root = await findRepoRootForTarget(
      { findRepoRoot },
      workspaceRoot,
      ".",
    );

    expect(root).toBe(workspaceRoot);
    expect(findRepoRoot).toHaveBeenCalledWith(workspaceRoot);
  });
});

describe("workspaceRelativeToRepoRelative", () => {
  it("strips the workspace prefix when the repo is nested", () => {
    const workspaceRoot = path.join(
      path.parse(process.cwd()).root,
      "Users",
      "dev",
      "monorepo",
    );
    const repoRel = workspaceRelativeToRepoRelative(
      workspaceRoot,
      path.join(workspaceRoot, "gitview"),
      "gitview/README.md",
    );
    expect(repoRel).toBe("README.md");
  });

  it("returns the path unchanged when workspace and repo roots match", () => {
    const workspaceRoot = path.join(
      path.parse(process.cwd()).root,
      "Users",
      "dev",
      "app",
    );
    const repoRel = workspaceRelativeToRepoRelative(
      workspaceRoot,
      workspaceRoot,
      "src/index.ts",
    );
    expect(repoRel).toBe("src/index.ts");
  });
});
