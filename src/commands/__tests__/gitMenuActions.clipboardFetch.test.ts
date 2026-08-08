import "./gitMenuActions.testSetup";
import { describe, it, expect, vi } from "vitest";
import * as vscode from "vscode";
import {
  gitCopyCommitId,
  gitCopyCommitMessage,
  gitFetch,
  gitAnnotateBlame,
  runGitMenuAction,
} from "../gitMenuActions";
import { openGitHistoryPanel } from "../../webview/GitHistoryWebviewPanel";
import {
  context,
  mockGitView,
  mockExecFilePromise,
  mockOpenGitViewBlamePanel,
} from "./gitMenuActions.testSetup";

describe("gitMenuActions clipboard and fetch", () => {
  it("copies commit id to clipboard", async () => {
    await gitCopyCommitId("abc123def456");
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith("abc123def456");
  });

  it("copies commit message to clipboard", async () => {
    await gitCopyCommitMessage("Fix bug");
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith("Fix bug");
  });

  it("dispatches fetch scoped to workspaceRoot in multi-root workspaces", async () => {
    await runGitMenuAction(context, { action: "fetch" }, "/repo-b");
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "fetch", "origin"],
      { cwd: "/repo-b" },
    );
  });

  it("dispatches fetch scoped to the right-clicked file repository", async () => {
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;
    await gitFetch(uri);
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "fetch", "origin"],
      { cwd: "/repo-b" },
    );
  });

  it("does not scope fetch to repo A when a repo B file is clicked", async () => {
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;
    await gitFetch(uri);
    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      ["--no-pager", "fetch"],
      { cwd: "/repo" },
    );
  });

  it("opens the GitView blame panel immediately and lets the panel load blame", async () => {
    await gitAnnotateBlame(
      context,
      mockGitView,
      vscode.Uri.file("/repo/src/app.ts") as vscode.Uri,
    );
    expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    expect(mockOpenGitViewBlamePanel).toHaveBeenCalledWith(
      context,
      mockGitView,
      expect.objectContaining({
        relativePath: "src/app.ts",
        lines: [],
        loading: true,
      }),
      undefined,
      "/repo",
    );
  });

  it("warns when annotate is invoked on a folder", async () => {
    vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({
      type: vscode.FileType.Directory,
    } as never);

    await gitAnnotateBlame(
      context,
      mockGitView,
      vscode.Uri.file("/repo/src") as vscode.Uri,
    );

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "Annotate with Git Blame is only available for files.",
    );
    expect(mockOpenGitViewBlamePanel).not.toHaveBeenCalled();
    expect(vi.mocked(openGitHistoryPanel)).not.toHaveBeenCalled();
  });

  it("warns when annotate is invoked on an empty folder", async () => {
    vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({
      type: vscode.FileType.Directory,
    } as never);

    await gitAnnotateBlame(
      context,
      mockGitView,
      vscode.Uri.file("/repo/empty") as vscode.Uri,
    );

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      "Annotate with Git Blame is only available for files.",
    );
    expect(mockOpenGitViewBlamePanel).not.toHaveBeenCalled();
    expect(vi.mocked(openGitHistoryPanel)).not.toHaveBeenCalled();
  });
});
