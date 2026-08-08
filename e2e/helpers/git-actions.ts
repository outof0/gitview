import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { createGitService } from "../../out/services/gitService";
import type { BlameLine, FileDiffView, GitCommitEntry } from "../../src/types/blame";
import {
  isGitMenuAction,
  isGitMenuWebviewAction,
} from "../../src/types/gitMenu";
import { isRepoWideGitMenuAction } from "../../src/types/gitMenu";
import type { GitViewEffect } from "./git-effects";

const exec = promisify(execFile);
const gitService = createGitService();

export const E2E_REPO_ROOT = path.resolve(process.cwd(), "test-conflict-repo");

export type GitMenuActionPayload = {
  action: string;
  relativePath?: string;
  isFolder?: boolean;
};

export type GitMenuActionResult = {
  effect?: GitViewEffect;
  diffPreview?: {
    title: string;
    relativePath: string;
    diff: FileDiffView;
  };
};

export type HistoryBootstrap = {
  path: string;
  isFolder: boolean;
  repoRoot: string;
  repoId?: string;
  branches: string[];
  currentBranch: string;
  commits: GitCommitEntry[];
};

export async function git(
  repoRoot: string,
  args: string[],
): Promise<string> {
  const { stdout } = await exec("git", ["--no-pager", ...args], {
    cwd: repoRoot,
  });
  return String(stdout);
}

export async function isPathStaged(
  repoRoot: string,
  relativePath: string,
): Promise<boolean> {
  const indexed = await git(repoRoot, [
    "diff",
    "--cached",
    "--name-only",
    "--",
    relativePath,
  ]);
  return indexed
    .trim()
    .split("\n")
    .filter(Boolean)
    .includes(relativePath);
}

export async function waitForGit(
  predicate: () => Promise<boolean>,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Timed out waiting for Git repository state");
}

export async function writeRepoFile(
  repoRoot: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absolute = path.join(repoRoot, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
}

export async function readRepoFile(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

export async function cleanupRepoPaths(
  repoRoot: string,
  relativePaths: string[],
): Promise<void> {
  for (const relativePath of relativePaths) {
    await git(repoRoot, ["reset", "--", relativePath]).catch(() => "");
    await fs.rm(path.join(repoRoot, relativePath), {
      recursive: true,
      force: true,
    });
  }
}

function folderScope(relativePath: string | undefined): string {
  if (!relativePath || relativePath === ".") {
    return ".";
  }
  return relativePath;
}

async function readBlobAtRef(
  repoRoot: string,
  ref: string,
  relativePath: string,
): Promise<string> {
  try {
    return await git(repoRoot, ["show", `${ref}:${relativePath}`]);
  } catch {
    return "";
  }
}

function splitDiffView(
  relativePath: string,
  leftLabel: string,
  rightLabel: string,
  leftText: string,
  rightText: string,
): FileDiffView {
  return {
    layout: "split",
    status: "M",
    left: { label: leftLabel, text: leftText },
    right: { label: rightLabel, text: rightText },
  };
}

export async function buildWorkingTreeDiff(
  repoRoot: string,
  relativePath: string,
): Promise<FileDiffView> {
  const headText = await readBlobAtRef(repoRoot, "HEAD", relativePath);
  const worktreeText = await readRepoFile(repoRoot, relativePath);
  return splitDiffView(
    relativePath,
    "HEAD",
    "Working Tree",
    headText,
    worktreeText,
  );
}

export async function buildRevisionDiff(
  repoRoot: string,
  relativePath: string,
  ref: string,
): Promise<FileDiffView> {
  const revisionText = await readBlobAtRef(repoRoot, ref, relativePath);
  const worktreeText = await readRepoFile(repoRoot, relativePath);
  const label = ref.length > 12 ? ref.slice(0, 7) : ref;
  return splitDiffView(
    relativePath,
    label,
    "Working Tree",
    revisionText,
    worktreeText,
  );
}

export async function buildBranchDiff(
  repoRoot: string,
  relativePath: string,
  branch: string,
): Promise<FileDiffView> {
  return buildRevisionDiff(repoRoot, relativePath, branch);
}

export async function fetchFileBlame(
  repoRoot: string,
  relativePath: string,
): Promise<BlameLine[]> {
  const result = await gitService.blameFile(repoRoot, "HEAD", relativePath);
  if (!result.ok) {
    return [];
  }
  return result.lines;
}

export async function buildHistoryBootstrap(
  repoRoot: string,
  targetPath: string,
  isFolder: boolean,
): Promise<HistoryBootstrap> {
  const branches = await gitService.listBranches(repoRoot);
  const branchInfo = await gitService.getBranchInfo(repoRoot);
  const log = isFolder
    ? await gitService.logFolder(
        repoRoot,
        targetPath === "./" ? "." : targetPath,
        { limit: 50 },
      )
    : await gitService.logFile(repoRoot, targetPath, { limit: 50 });

  return {
    path: targetPath,
    isFolder,
    repoRoot,
    branches,
    currentBranch: branchInfo.currentBranch,
    commits: log.ok ? log.commits : [],
  };
}

async function pickRevision(
  repoRoot: string,
  relativePath: string,
): Promise<string | null> {
  const log = await gitService.logFile(repoRoot, relativePath, { limit: 5 });
  if (log.ok && log.commits[0]) {
    return log.commits[0].sha;
  }
  const repoLog = await gitService.logFolder(repoRoot, ".", { limit: 5 });
  return repoLog.ok && repoLog.commits[0] ? repoLog.commits[0].sha : null;
}

async function pickComparisonBranch(repoRoot: string): Promise<string | null> {
  const branches = await gitService.listBranches(repoRoot);
  const current = (await gitService.getBranchInfo(repoRoot)).currentBranch;
  return branches.find((branch) => branch !== current) ?? branches[0] ?? null;
}

/**
 * Executes webview git:menuAction side effects against a real repository.
 */
export async function executeWebviewGitMenuAction(
  repoRoot: string,
  payload: GitMenuActionPayload,
): Promise<GitMenuActionResult> {
  if (!isGitMenuAction(payload.action)) {
    return {};
  }

  if (isRepoWideGitMenuAction(payload.action)) {
    return {};
  }

  if (!isGitMenuWebviewAction(payload.action)) {
    return {};
  }

  const { action, relativePath, isFolder } = payload;

  switch (action) {
    case "add":
      if (isFolder) {
        await git(repoRoot, ["add", "--", folderScope(relativePath)]);
      } else if (relativePath) {
        await git(repoRoot, ["add", "--", relativePath]);
      } else {
        await git(repoRoot, ["add", "-A"]);
      }
      return {};
    case "unstage":
      if (isFolder) {
        await git(repoRoot, ["reset", "HEAD", "--", folderScope(relativePath)]);
      } else if (relativePath) {
        await git(repoRoot, ["reset", "HEAD", "--", relativePath]);
      } else {
        await git(repoRoot, ["reset", "HEAD"]);
      }
      return {};
    case "rollback":
      if (relativePath) {
        await git(repoRoot, ["checkout", "HEAD", "--", relativePath]).catch(
          async () => {
            await git(repoRoot, ["restore", "--worktree", "--", relativePath]);
          },
        );
      }
      return {};
    case "showDiff": {
      if (!relativePath || isFolder) {
        return {};
      }
      const diff = await buildWorkingTreeDiff(repoRoot, relativePath);
      const title = `${path.basename(relativePath)} (HEAD ↔ Working Tree)`;
      return {
        effect: { type: "diffPreview", relativePath, title, diff },
        diffPreview: { title, relativePath, diff },
      };
    }
    case "compareWithRevision": {
      if (!relativePath || isFolder) {
        return {};
      }
      const sha = await pickRevision(repoRoot, relativePath);
      if (!sha) {
        return {};
      }
      const diff = await buildRevisionDiff(repoRoot, relativePath, sha);
      const title = `${path.basename(relativePath)} (${sha.slice(0, 7)} ↔ Working Tree)`;
      return {
        effect: { type: "diffPreview", relativePath, title, diff },
        diffPreview: { title, relativePath, diff },
      };
    }
    case "compareWithBranch": {
      if (!relativePath || isFolder) {
        return {};
      }
      const branch = await pickComparisonBranch(repoRoot);
      if (!branch) {
        return {};
      }
      const diff = await buildBranchDiff(repoRoot, relativePath, branch);
      const title = `${path.basename(relativePath)} (${branch} ↔ Working Tree)`;
      return {
        effect: { type: "diffPreview", relativePath, title, diff },
        diffPreview: { title, relativePath, diff },
      };
    }
    case "annotateBlame": {
      if (!relativePath || isFolder) {
        return {};
      }
      const lines = await fetchFileBlame(repoRoot, relativePath);
      return {
        effect: { type: "blame", relativePath, lines },
      };
    }
    default:
      return {};
  }
}

export async function handleGitHistoryOpen(
  repoRoot: string,
  targetPath: string,
  isFolder: boolean,
): Promise<HistoryBootstrap> {
  const bootstrap = await buildHistoryBootstrap(repoRoot, targetPath, isFolder);
  return bootstrap;
}