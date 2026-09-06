import * as vscode from "vscode";
import {
  buildRemoteLink,
  parseGitRemoteUrl,
  remoteLinkMarkdownLabel,
  toRemoteLinkMarkdown,
  type RemoteLinkTarget,
} from "../core/remoteLink";
import {
  resolveRemoteLinkContext,
  type RemoteLinkRefMode,
} from "../services/git/remoteLink";
import { warnNoGitRepository } from "./gitMenuContext";
import {
  getGitCommandRuntime,
  isDirectoryResource,
  repoRelativePath,
  resolveRepoRoot,
  resolveWorkspaceRoot,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";

export type RemoteLinkCopyMode = "open" | "copy" | "markdown";

export type RemoteLinkOptions = {
  /** Commit SHA from history menus: link the commit instead of the file. */
  commitSha?: string;
  /** Folder hint from the webview dispatcher (avoids a disk stat). */
  isFolder?: boolean;
  copyMode?: RemoteLinkCopyMode;
};

function readRemoteLinkSettings(): {
  remote: string;
  refMode: RemoteLinkRefMode;
  customTemplate: string;
} {
  const config = vscode.workspace.getConfiguration("gitView");
  const remote = config.get<string>("remoteName", "origin").trim() || "origin";
  const rawMode = config.get<string>("remoteLinkRefMode", "auto");
  const refMode: RemoteLinkRefMode =
    rawMode === "branch" || rawMode === "commit" ? rawMode : "auto";
  const customTemplate = config.get<string>("remoteLinkCustomTemplate", "");
  return { remote, refMode, customTemplate: customTemplate.trim() };
}

function activeSelectionFor(
  resource: vscode.Uri | undefined,
): { start: number; end: number } | null {
  const editor = vscode.window.activeTextEditor;
  if (!resource || !editor || editor.document.uri.fsPath !== resource.fsPath) {
    return null;
  }
  const { anchor, active } = editor.selection;
  const start = Math.min(anchor.line, active.line) + 1;
  const end = Math.max(anchor.line, active.line) + 1;
  return { start, end };
}

async function runRemoteLink(
  resource: vscode.Uri | undefined,
  workspaceRoot: string | undefined,
  runtime: GitCommandRuntime | undefined,
  opts: RemoteLinkOptions & { copyMode: RemoteLinkCopyMode },
): Promise<void> {
  const resolved = getGitCommandRuntime(runtime);
  const fileResource =
    resource ??
    (vscode.window.activeTextEditor?.document.uri.scheme === "file"
      ? vscode.window.activeTextEditor?.document.uri
      : undefined);
  const effectiveWorkspaceRoot = resolveWorkspaceRoot(workspaceRoot);
  const repoRoot = await resolveRepoRoot(
    fileResource,
    effectiveWorkspaceRoot,
    resolved,
  );
  if (!repoRoot) {
    warnNoGitRepository("Remote Link");
    return;
  }

  const { remote, refMode, customTemplate } = readRemoteLinkSettings();
  const context = await resolveRemoteLinkContext(
    resolved.gitService.execGit,
    repoRoot,
    remote,
    refMode,
  );
  if (!context) {
    void vscode.window.showErrorMessage(
      `No remote "${remote}" found for this repository.`,
    );
    return;
  }

  const commitSha = opts.commitSha?.trim() || undefined;
  const ref = commitSha ? { type: "commit" as const, sha: commitSha } : context.ref;

  let target: RemoteLinkTarget;
  const fileRel =
    fileResource && fileResource.scheme === "file"
      ? repoRelativePath(fileResource, repoRoot)
      : null;
  if (!fileRel) {
    target = commitSha ? { type: "commit", sha: commitSha } : { type: "repo" };
  } else if (opts.isFolder ?? (await isDirectoryResource(fileResource!))) {
    if (!ref) {
      void vscode.window.showWarningMessage(
        "Push the current branch or commit before creating a remote file link.",
      );
      return;
    }
    target = { type: "dir", path: fileRel };
  } else {
    if (!ref) {
      void vscode.window.showWarningMessage(
        "Push the current branch or commit before creating a remote file link.",
      );
      return;
    }
    const selection = commitSha
      ? null
      : activeSelectionFor(fileResource ?? undefined);
    target = selection
      ? {
          type: "file",
          path: fileRel,
          startLine: selection.start,
          endLine: selection.end,
        }
      : { type: "file", path: fileRel };
  }

  const url = buildRemoteLink({
    remoteUrl: context.remoteUrl,
    target,
    ref: ref ?? undefined,
    customTemplate: customTemplate ? customTemplate : undefined,
  });
  if (!url) {
    void vscode.window.showErrorMessage(
      "Could not build a remote link for this repository. " +
        'Set "gitView.remoteLinkCustomTemplate" for unrecognised hosts.',
    );
    return;
  }

  if (opts.copyMode === "open") {
    await vscode.env.openExternal(vscode.Uri.parse(url));
    return;
  }
  const parsed = parseGitRemoteUrl(context.remoteUrl);
  const label = remoteLinkMarkdownLabel(target, parsed?.repoPath ?? "");
  const text = opts.copyMode === "markdown" ? toRemoteLinkMarkdown(label, url) : url;
  await vscode.env.clipboard.writeText(text);
  void vscode.window.showInformationMessage(
    "Copied remote link to clipboard.",
  );
}

/** Open the current file, folder, or commit on the remote host. */
export async function gitOpenOnRemote(
  resource: vscode.Uri | undefined,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  opts: RemoteLinkOptions = {},
): Promise<void> {
  await runRemoteLink(resource, workspaceRoot, runtime, {
    ...opts,
    copyMode: "open",
  });
}

/** Copy the remote-host link for the current file, folder, or commit. */
export async function gitCopyRemoteLink(
  resource: vscode.Uri | undefined,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  opts: RemoteLinkOptions = {},
): Promise<void> {
  await runRemoteLink(resource, workspaceRoot, runtime, {
    ...opts,
    copyMode: "copy",
  });
}

/** Copy the remote-host link as Markdown. */
export async function gitCopyRemoteLinkMarkdown(
  resource: vscode.Uri | undefined,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  opts: RemoteLinkOptions = {},
): Promise<void> {
  await runRemoteLink(resource, workspaceRoot, runtime, {
    ...opts,
    copyMode: "markdown",
  });
}
