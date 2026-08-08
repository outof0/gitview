import { realpathSync } from "node:fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  createDefaultExecGit,
  createGitService,
  type GitService,
} from "../services/gitService";
import type { ShelfStorage } from "../storage/shelfStorage";
import {
  findRepoRootForTarget,
  workspaceRelativeToRepoRelative,
} from "../util/gitRepoRoot";
import { resolveGitRepository } from "../util/vscodeGit";
import { coerceContextMenuResourceUri } from "./contextMenuResource";
import { warnNoGitRepository } from "./gitMenuContext";

export type GitCommandRuntime = {
  gitService: GitService;
  shelfStorage?: ShelfStorage;
  refresh?: () => Promise<unknown>;
  getUpdateStrategy?: () => "merge" | "rebase" | "ff_only";
  getGpgSigningDefault?: () => boolean;
};

/** Standalone adapter for tests/back-compat callers; production injects one runtime. */
export function createStandaloneGitCommandRuntime(): GitCommandRuntime {
  return { gitService: createGitService({ execGit: createDefaultExecGit() }) };
}

const standaloneRuntime = createStandaloneGitCommandRuntime();

/** Resolve the injected runtime, with an immutable standalone fallback for API callers. */
export function getGitCommandRuntime(
  runtime?: GitCommandRuntime,
): GitCommandRuntime {
  return runtime ?? standaloneRuntime;
}

export async function refreshAfterGitMutation(
  runtime?: GitCommandRuntime,
): Promise<void> {
  await getGitCommandRuntime(runtime).refresh?.();
}

/** Back-compatible command adapter over the shared injected Git runner. */
export async function execGit(
  _binary: string,
  args: string[],
  options?: { cwd?: string; maxBuffer?: number; env?: NodeJS.ProcessEnv },
  runtime?: GitCommandRuntime,
): Promise<{ stdout: string; stderr: string }> {
  if (!options?.cwd) {
    throw new Error("Git command requires an explicit repository root.");
  }
  const normalizedArgs = args[0] === "--no-pager" ? args.slice(1) : args;
  return getGitCommandRuntime(runtime).gitService.execGit(options.cwd, normalizedArgs, {
    maxBuffer: options.maxBuffer,
    env: options.env,
  });
}

export type DiffPreviewPoster = (payload: {
  relativePath: string;
  title: string;
  diff: import("../types/blame").FileDiffView;
}) => void | Promise<void>;

export function resolveWorkspaceRoot(workspaceRoot?: string): string | undefined {
  return workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function resolveWorkspaceRootForUri(
  uri: vscode.Uri,
  workspaceRoot?: string,
): string | undefined {
  if (uri.scheme === "file") {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      return folder.uri.fsPath;
    }
  }
  return resolveWorkspaceRoot(workspaceRoot);
}

export function resolveResourceUri(
  relativePath?: string,
  resource?: vscode.Uri,
  workspaceRoot?: string,
  ...fallbackArgs: unknown[]
): vscode.Uri | undefined {
  const coerced = coerceContextMenuResourceUri(resource, ...fallbackArgs);
  if (coerced) {
    return coerced;
  }
  const root = resolveWorkspaceRoot(workspaceRoot);
  if (relativePath && root) {
    return vscode.Uri.file(path.join(root, relativePath));
  }
  return undefined;
}

export async function resolveRepoFileUri(
  relativePath: string,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<vscode.Uri | undefined> {
  const root = resolveWorkspaceRoot(workspaceRoot);
  if (!root) {
    return undefined;
  }
  const repoRoot = await findRepoRootForTarget(
    getGitCommandRuntime(runtime).gitService,
    root,
    relativePath,
  );
  if (!repoRoot) {
    return undefined;
  }
  const repoRel = workspaceRelativeToRepoRelative(root, repoRoot, relativePath);
  return vscode.Uri.file(path.join(repoRoot, repoRel));
}

export async function fileExistsOnDisk(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function resolveRepoScopeUri(
  resource?: vscode.Uri,
  workspaceRoot?: string,
): vscode.Uri | undefined {
  return (
    resolveResourceUri(undefined, resource, workspaceRoot) ??
    (workspaceRoot ? vscode.Uri.file(workspaceRoot) : undefined)
  );
}

export function repoRelativePath(uri: vscode.Uri, repoRoot: string): string | null {
  let resolvedRoot = repoRoot;
  let resolvedUri = uri.fsPath;
  try {
    resolvedRoot = realpathSync.native(repoRoot);
    resolvedUri = realpathSync.native(uri.fsPath);
  } catch {
    // Fall back to unresolved paths when the resource is missing on disk.
  }
  const rel = path.relative(resolvedRoot, resolvedUri).replace(/\\/g, "/");
  return rel && !rel.startsWith("../") && rel !== ".." ? rel : null;
}

export async function isDirectoryResource(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.Directory) !== 0;
  } catch {
    return false;
  }
}

export async function resolveRepoRoot(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<string | undefined> {
  const scopeUri = resolveRepoScopeUri(resource, workspaceRoot);
  if (!scopeUri) {
    return undefined;
  }
  const gitService = getGitCommandRuntime(runtime).gitService;
  const fromScope = await gitService.findRepoRoot(scopeUri.fsPath);
  if (fromScope) {
    return fromScope;
  }
  const folderRoot = resolveWorkspaceRootForUri(scopeUri, workspaceRoot);
  if (!folderRoot || folderRoot === scopeUri.fsPath) {
    return undefined;
  }
  return (await gitService.findRepoRoot(folderRoot)) ?? undefined;
}

export async function resolveRepoRootFromRelative(
  workspaceRoot?: string,
  relativePath?: string,
  resource?: vscode.Uri,
  runtime?: GitCommandRuntime,
): Promise<string | undefined> {
  const fromResource = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (fromResource) {
    return fromResource;
  }
  const ws = resolveWorkspaceRoot(workspaceRoot);
  if (!ws) {
    return undefined;
  }
  return (
    (await findRepoRootForTarget(getGitCommandRuntime(runtime).gitService, ws, relativePath)) ??
    undefined
  );
}

export function toRepoRelativePath(
  workspaceRoot: string,
  repoRoot: string,
  pathInWorkspace: string,
): string {
  return workspaceRelativeToRepoRelative(
    workspaceRoot,
    repoRoot,
    pathInWorkspace,
  );
}

export async function resolveCommitMessage(
  resource?: vscode.Uri,
  workspaceRoot?: string,
): Promise<string | undefined> {
  const scopeUri = resolveRepoScopeUri(resource, workspaceRoot);
  const repository = scopeUri
    ? await resolveGitRepository(scopeUri)
    : undefined;
  const message = repository?.inputBox?.value?.trim();
  return message || undefined;
}

export async function promptCommitMessage(title: string): Promise<string | undefined> {
  const message = await vscode.window.showInputBox({
    title,
    prompt: "Enter a commit message",
    placeHolder: "Describe your changes",
    validateInput: (value) =>
      value.trim() ? undefined : "Enter a commit message.",
  });
  return message?.trim() || undefined;
}

export async function runGitInRepo(
  resource: vscode.Uri | undefined,
  workspaceRoot: string | undefined,
  args: string[],
  actionLabel?: string,
  runtime?: GitCommandRuntime,
): Promise<string | undefined> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository(actionLabel ?? "Git");
    return undefined;
  }
  await execGit("git", ["--no-pager", ...args], { cwd: repoRoot }, runtime);
  return repoRoot;
}

export async function execGitInRepo(
  repoRoot: string,
  args: string[],
  runtime?: GitCommandRuntime,
): Promise<void> {
  await execGit("git", ["--no-pager", ...args], { cwd: repoRoot }, runtime);
}

export function scopePathForResource(
  uri: vscode.Uri | undefined,
  repoRoot: string,
): string | null {
  if (!uri || uri.scheme !== "file") {
    return null;
  }
  return repoRelativePath(uri, repoRoot);
}

export async function currentBranchName(
  repoRoot: string,
  runtime?: GitCommandRuntime,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(
      "git",
      ["--no-pager", "branch", "--show-current"],
      { cwd: repoRoot },
      runtime,
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function pickBranch(
  repoRoot: string,
  title: string,
  options?: { excludeCurrent?: boolean },
  runtime?: GitCommandRuntime,
): Promise<string | undefined> {
  const current = options?.excludeCurrent
    ? await currentBranchName(repoRoot, runtime)
    : null;
  const branches = (await getGitCommandRuntime(runtime).gitService.listBranches(repoRoot)).filter(
    (branch) => branch && branch !== current,
  );
  if (branches.length === 0) {
    void vscode.window.showWarningMessage("No Git branches found.");
    return undefined;
  }
  return vscode.window.showQuickPick(branches, {
    title,
    placeHolder: "Select a branch",
  });
}

export async function switchBranch(
  repoRoot: string,
  branch: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  try {
    await execGitInRepo(repoRoot, ["switch", branch], runtime);
  } catch {
    await execGitInRepo(repoRoot, ["checkout", branch], runtime);
  }
}

export async function createAndSwitchBranch(
  repoRoot: string,
  branch: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  try {
    await execGitInRepo(repoRoot, ["switch", "-c", branch], runtime);
  } catch {
    await execGitInRepo(repoRoot, ["checkout", "-b", branch], runtime);
  }
}

export async function countWorktreeChanges(
  repoRoot: string,
  runtime?: GitCommandRuntime,
): Promise<number> {
  try {
    const { stdout } = await execGit(
      "git",
      ["--no-pager", "status", "--porcelain=v1"],
      { cwd: repoRoot },
      runtime,
    );
    return String(stdout)
      .split("\n")
      .filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

export async function confirmRepositoryMutation(
  repoRoot: string,
  actionLabel: string,
  message: string,
  runtime?: GitCommandRuntime,
): Promise<boolean> {
  const dirty = (await countWorktreeChanges(repoRoot, runtime)) > 0;
  const dirtyWarning = dirty
    ? " The worktree has uncommitted changes; this action may conflict with or overwrite local work."
    : "";
  const choice = await vscode.window.showWarningMessage(
    `${message}${dirtyWarning}`,
    { modal: true },
    actionLabel,
  );
  return choice === actionLabel;
}
