import * as vscode from "vscode";
import {
  buildParentCommitDiffView,
  buildRefDiffView,
  buildRootCommitDiffView,
  buildWorkingTreeDiffView,
  diffPreviewTitle,
} from "../util/gitDiffPreview";
import type { GitViewContext } from "../application/gitViewContext";
import { warnNoGitRepository } from "./gitMenuContext";
import { showGitHistory } from "./showGitHistory";
import {
  execGit,
  execGitInRepo,
  getGitCommandRuntime,
  isDirectoryResource,
  repoRelativePath,
  resolveRepoRoot,
  resolveRepoRootFromRelative,
  resolveResourceUri,
  resolveWorkspaceRoot,
  toRepoRelativePath,
  type DiffPreviewPoster,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";
import type { GitMenuPresentation } from "./gitMenuPresentation";

export type { DiffPreviewPoster };

/**
 * 1-based line under the cursor for the given file.
 * Prefers the active editor; falls back to any visible editor showing the file.
 * If the cursor is at line 1 but the viewport is scrolled elsewhere (common when
 * focus is on Explorer), use the middle of the visible range instead.
 */
export function captureEditorFocusLine(fileUri: vscode.Uri): number | undefined {
  const isFileEditor = (editor: vscode.TextEditor): boolean =>
    editor.document.uri.scheme === "file" &&
    editor.document.uri.fsPath === fileUri.fsPath;

  const editor =
    (vscode.window.activeTextEditor && isFileEditor(vscode.window.activeTextEditor)
      ? vscode.window.activeTextEditor
      : undefined) ??
    vscode.window.visibleTextEditors.find(isFileEditor);

  if (!editor) {
    return undefined;
  }

  const cursorLine = editor.selection.active.line; // 0-based
  const visible = editor.visibleRanges[0];
  // Cursor parked at top while the user had scrolled further down.
  if (
    cursorLine === 0 &&
    editor.selection.isEmpty &&
    visible &&
    visible.start.line > 0
  ) {
    return Math.floor((visible.start.line + visible.end.line) / 2) + 1;
  }
  return cursorLine + 1;
}

async function postOrOpenDiff(
  preview: Parameters<DiffPreviewPoster>[0],
  workspaceRoot: string | undefined,
  postDiffPreview: DiffPreviewPoster | undefined,
  presentation: GitMenuPresentation | undefined,
  options?: { reusePanel?: boolean; openInActiveColumn?: boolean },
): Promise<void> {
  if (postDiffPreview) {
    await postDiffPreview(preview);
    return;
  }
  if (!presentation) {
    throw new Error("Git diff presentation is not configured.");
  }
  await presentation.openDiff({
    preview,
    workspaceRoot,
    reusePanel: options?.reusePanel,
    openInActiveColumn: options?.openInActiveColumn,
  });
}

/** Git → Show History. */
export function gitShowHistory(
  _context: vscode.ExtensionContext,
  gitView: GitViewContext,
  resource?: vscode.Uri,
): Promise<void> {
  return showGitHistory(resource, gitView.gitMenuPresentation);
}

/** Compare with Revision — pick commit, diff vs working tree. */
export async function gitCompareWithRevision(
  _context: vscode.ExtensionContext,
  resource?: vscode.Uri,
  workspaceRoot?: string,
  postDiffPreview?: DiffPreviewPoster,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  if (!uri || uri.scheme !== "file") {
    void vscode.window.showWarningMessage(
      "Compare with Revision requires a workspace file.",
    );
    return;
  }

  const repoRoot = await resolveRepoRoot(uri, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Compare with Revision");
    return;
  }

  const rel = repoRelativePath(uri, repoRoot);
  if (!rel) {
    void vscode.window.showWarningMessage(
      "File must be inside the Git repository.",
    );
    return;
  }

  const resolved = getGitCommandRuntime(runtime);
  const log = await resolved.gitService.logFile(repoRoot, rel, { limit: 50 });
  if (!log.ok || log.commits.length === 0) {
    void vscode.window.showWarningMessage("No revisions found for this file.");
    return;
  }

  const pick = await vscode.window.showQuickPick(
    log.commits.map((c) => ({
      label: c.shortSha,
      description: c.subject,
      detail: c.author,
      sha: c.sha,
    })),
    { title: "Compare with Revision", placeHolder: "Select a revision" },
  );
  if (!pick) {
    return;
  }

  const diff = await buildRefDiffView(
    repoRoot,
    rel,
    pick.sha,
    pick.label,
    resolved.gitService.execGit,
  );
  const title = diffPreviewTitle(rel, pick.label, "Working Tree");
  const preview = { relativePath: rel, title, diff };
  await postOrOpenDiff(
    preview,
    workspaceRoot,
    postDiffPreview,
    presentation,
  );
}

/** Compare with Branch — pick branch, diff vs working tree. */
export async function gitCompareWithBranch(
  _context: vscode.ExtensionContext,
  resource?: vscode.Uri,
  workspaceRoot?: string,
  postDiffPreview?: DiffPreviewPoster,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  if (!uri || uri.scheme !== "file") {
    void vscode.window.showWarningMessage(
      "Compare with Branch requires a workspace file or folder.",
    );
    return;
  }

  const repoRoot = await resolveRepoRoot(uri, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Compare with Branch");
    return;
  }

  const resolved = getGitCommandRuntime(runtime);
  const branches = await resolved.gitService.listBranches(repoRoot);
  const pick = await vscode.window.showQuickPick(branches, {
    title: "Compare with Branch",
    placeHolder: "Select a branch",
  });
  if (!pick) {
    return;
  }

  const rel = repoRelativePath(uri, repoRoot);
  if (!rel) {
    void vscode.window.showWarningMessage(
      "File must be inside the Git repository.",
    );
    return;
  }

  const diff = await buildRefDiffView(
    repoRoot,
    rel,
    pick,
    pick,
    resolved.gitService.execGit,
  );
  const title = diffPreviewTitle(rel, pick, "Working Tree");
  const preview = { relativePath: rel, title, diff };
  await postOrOpenDiff(
    preview,
    workspaceRoot,
    postDiffPreview,
    presentation,
  );
}

export async function gitShowDiff(
  _context: vscode.ExtensionContext,
  resource?: vscode.Uri,
  workspaceRoot?: string,
  postDiffPreview?: (payload: {
    relativePath: string;
    title: string;
    diff: import("../types/blame").FileDiffView;
  }) => void | Promise<void>,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  if (!uri || uri.scheme !== "file") {
    void vscode.window.showWarningMessage("Show Diff requires a file.");
    return;
  }

  const repoRoot = await resolveRepoRoot(uri, workspaceRoot, runtime);
  const rel = repoRoot ? repoRelativePath(uri, repoRoot) : null;

  if (!repoRoot || !rel) {
    warnNoGitRepository("Show Diff");
    return;
  }

  try {
    const diff = await buildWorkingTreeDiffView(
      repoRoot,
      rel,
      getGitCommandRuntime(runtime).gitService.execGit,
    );
    const title = diffPreviewTitle(rel, "HEAD", "Working Tree");
    const preview = { relativePath: rel, title, diff };
    await postOrOpenDiff(
      preview,
      workspaceRoot,
      postDiffPreview,
      presentation,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Annotate with Git Blame — GitView blame panel (git CLI), not built-in Git decorations. */
export async function gitAnnotateBlame(
  _context: vscode.ExtensionContext,
  gitView: GitViewContext,
  resource?: vscode.Uri,
  workspaceRoot?: string,
  ...commandArgs: unknown[]
): Promise<void> {
  const uri = resolveResourceUri(
    undefined,
    resource,
    workspaceRoot,
    ...commandArgs,
  );
  if (!uri || uri.scheme !== "file") {
    void vscode.window.showWarningMessage(
      "Annotate requires a workspace file. Right-click a file in Explorer or use Annotate from the editor tab.",
    );
    return;
  }

  const repoRoot = await resolveRepoRoot(
    uri,
    workspaceRoot,
    gitView.commandRuntime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Annotate");
    return;
  }

  const isDirectory = await isDirectoryResource(uri);
  if (isDirectory) {
    void vscode.window.showWarningMessage(
      "Annotate with Git Blame is only available for files.",
    );
    return;
  }

  const rel = repoRelativePath(uri, repoRoot);
  if (!rel) {
    void vscode.window.showWarningMessage(
      "Could not resolve a file inside the Git repository.",
    );
    return;
  }

  // Preserve the user's place in the file (cursor / visible line).
  const focusLine = captureEditorFocusLine(uri);

  try {
    await gitView.gitMenuPresentation.openBlame({
      relativePath: rel,
      workspaceRoot,
      repoRoot,
      focusLine,
    });
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Could not open blame for ${rel}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Rollback — discard local changes for the selected file. */
export async function gitRollback(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  if (!uri || uri.scheme !== "file") {
    void vscode.window.showWarningMessage(
      "Rollback requires a workspace file.",
    );
    return;
  }

  const repoRoot = await resolveRepoRoot(uri, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Rollback");
    return;
  }

  const rel = repoRelativePath(uri, repoRoot);
  if (!rel) {
    void vscode.window.showWarningMessage(
      "Could not resolve path inside repository.",
    );
    return;
  }

  const name = vscode.workspace.asRelativePath(uri, false);
  const choice = await vscode.window.showWarningMessage(
    `Rollback local changes in ${name}? Uncommitted edits will be lost.`,
    "Rollback",
  );
  if (choice !== "Rollback") {
    return;
  }

  try {
    await execGitInRepo(
      repoRoot,
      ["restore", "--worktree", "--", rel],
      runtime,
    );
    await getGitCommandRuntime(runtime).refresh?.();
  } catch {
    try {
      await execGitInRepo(repoRoot, ["checkout", "--", rel], runtime);
      await getGitCommandRuntime(runtime).refresh?.();
    } catch {
      try {
        await execGitInRepo(repoRoot, ["clean", "-fd", "--", rel], runtime);
        await getGitCommandRuntime(runtime).refresh?.();
      } catch (err) {
        void vscode.window.showErrorMessage(
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
}
export async function gitCompareWithLocal(
  _context: vscode.ExtensionContext,
  commitSha: string,
  relativePath: string,
  workspaceRoot?: string,
  postDiffPreview?: DiffPreviewPoster,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const root = resolveWorkspaceRoot(workspaceRoot);
  if (!root) {
    return;
  }

  const repoRoot = await resolveRepoRootFromRelative(
    workspaceRoot,
    relativePath,
    undefined,
    runtime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Compare with Local");
    return;
  }
  const repoRel = toRepoRelativePath(root, repoRoot, relativePath);

  const commitLabel = commitSha.slice(0, 7);
  const diff = await buildRefDiffView(
    repoRoot,
    repoRel,
    commitSha,
    commitLabel,
    getGitCommandRuntime(runtime).gitService.execGit,
  );
  const title = diffPreviewTitle(repoRel, commitLabel, "Working Tree");
  const preview = { relativePath: repoRel, title, diff };
  await postOrOpenDiff(
    preview,
    workspaceRoot,
    postDiffPreview,
    presentation,
  );
}

/** History Show Diff — parent revision vs commit in the GitView diff panel. */
export async function gitShowRevisionDiff(
  _context: vscode.ExtensionContext,
  commitSha: string,
  relativePath: string,
  workspaceRoot?: string,
  postDiffPreview?: DiffPreviewPoster,
  reuseDiffPanel?: boolean,
  openInActiveColumn?: boolean,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const root = resolveWorkspaceRoot(workspaceRoot);
  if (!root) {
    return;
  }

  const repoRoot = await resolveRepoRootFromRelative(
    workspaceRoot,
    relativePath,
    undefined,
    runtime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Show Revision Diff");
    return;
  }
  const repoRel = toRepoRelativePath(root, repoRoot, relativePath);

  let parentSha: string | null = null;
  try {
    const { stdout } = await execGit(
      "git",
      ["--no-pager", "rev-parse", `${commitSha}^`],
      { cwd: repoRoot },
      runtime,
    );
    parentSha = stdout.trim() || null;
  } catch {
    parentSha = null;
  }

  const commitLabel = commitSha.slice(0, 7);
  const diff = parentSha
    ? await buildParentCommitDiffView(
        repoRoot,
        repoRel,
        parentSha,
        commitSha,
        getGitCommandRuntime(runtime).gitService.execGit,
      )
    : await buildRootCommitDiffView(
        repoRoot,
        repoRel,
        commitSha,
        getGitCommandRuntime(runtime).gitService.execGit,
      );
  const leftLabel = parentSha ? parentSha.slice(0, 7) : "∅";
  const title = diffPreviewTitle(repoRel, leftLabel, commitLabel);
  const preview = { relativePath: repoRel, title, diff };
  await postOrOpenDiff(
    preview,
    workspaceRoot,
    postDiffPreview,
    presentation,
    { reusePanel: reuseDiffPanel, openInActiveColumn },
  );
}
