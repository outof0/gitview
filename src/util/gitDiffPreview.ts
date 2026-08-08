import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FileDiffView } from "../types/blame";
import { defaultExecGit } from "../services/git/exec";
import type { GitExecFn } from "../services/git/types";
import { stripGitConflictMarkers } from "./stripGitConflictMarkers";

async function git(
  execGit: GitExecFn,
  repoRoot: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execGit(repoRoot, args);
  return stdout;
}

async function readBlobAtRef(
  repoRoot: string,
  ref: string,
  relativePath: string,
  execGit: GitExecFn,
): Promise<string> {
  try {
    return await git(execGit, repoRoot, ["show", `${ref}:${relativePath}`]);
  } catch {
    return "";
  }
}

async function readWorktree(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    // Compare shows clean source — never VS Code merge-marker chrome.
    return stripGitConflictMarkers(raw);
  } catch {
    return "";
  }
}

function splitDiffView(
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

/** One panel when unchanged; side-by-side when parent and commit differ. */
function revisionDiffView(
  leftLabel: string,
  rightLabel: string,
  leftText: string,
  rightText: string,
): FileDiffView {
  if (leftText === rightText) {
    return {
      layout: "single",
      status: "M",
      left: null,
      right: { label: rightLabel, text: rightText },
    };
  }
  if (!leftText && rightText) {
    return {
      layout: "single",
      status: "A",
      left: null,
      right: { label: rightLabel, text: rightText },
    };
  }
  if (leftText && !rightText) {
    return {
      layout: "single",
      status: "D",
      left: { label: leftLabel, text: leftText },
      right: null,
    };
  }
  return splitDiffView(leftLabel, rightLabel, leftText, rightText);
}

export async function buildWorkingTreeDiffView(
  repoRoot: string,
  relativePath: string,
  execGit: GitExecFn = defaultExecGit,
): Promise<FileDiffView> {
  const headText = await readBlobAtRef(repoRoot, "HEAD", relativePath, execGit);
  const worktreeText = await readWorktree(repoRoot, relativePath);
  return splitDiffView("HEAD", "Working Tree", headText, worktreeText);
}

export async function buildRefDiffView(
  repoRoot: string,
  relativePath: string,
  ref: string,
  refLabel?: string,
  execGit: GitExecFn = defaultExecGit,
): Promise<FileDiffView> {
  const leftText = await readBlobAtRef(repoRoot, ref, relativePath, execGit);
  const worktreeText = await readWorktree(repoRoot, relativePath);
  const label = refLabel ?? (ref.length > 12 ? ref.slice(0, 7) : ref);
  return splitDiffView(label, "Working Tree", leftText, worktreeText);
}

export async function buildParentCommitDiffView(
  repoRoot: string,
  relativePath: string,
  parentSha: string,
  commitSha: string,
  execGit: GitExecFn = defaultExecGit,
): Promise<FileDiffView> {
  const leftText = await readBlobAtRef(repoRoot, parentSha, relativePath, execGit);
  const rightText = await readBlobAtRef(repoRoot, commitSha, relativePath, execGit);
  return revisionDiffView(
    parentSha.slice(0, 7),
    commitSha.slice(0, 7),
    leftText,
    rightText,
  );
}

export async function buildRootCommitDiffView(
  repoRoot: string,
  relativePath: string,
  commitSha: string,
  execGit: GitExecFn = defaultExecGit,
): Promise<FileDiffView> {
  const rightText = await readBlobAtRef(repoRoot, commitSha, relativePath, execGit);
  return {
    layout: "single",
    status: "A",
    left: null,
    right: { label: commitSha.slice(0, 7), text: rightText },
  };
}

export function diffPreviewTitle(
  relativePath: string,
  leftLabel: string,
  rightLabel: string,
): string {
  return `${path.basename(relativePath)} (${leftLabel} ↔ ${rightLabel})`;
}
