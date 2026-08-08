import "./gitMenuActions.testSetup";
import { describe, it, expect, vi } from "vitest";
import * as vscode from "vscode";
import {
  gitCompareWithBranch,
  gitCompareWithRevision,
  gitShowRevisionDiff,
  runGitMenuAction,
} from "../gitMenuActions";
import {
  context,
  mockExecFilePromise,
  mockFindRepoRoot,
  mockGitMenuPresentation,
  mockListBranches,
  mockLogFile,
  mockGitView,
  mockOpenGitViewPanel,
} from "./gitMenuActions.testSetup";

describe("gitMenuActions compare and revision diff", () => {
  it("gitCompareWithRevision opens GitView diff panel for the picked revision", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
      label: "abc1234",
      description: "Fix bug",
      detail: "Jane",
      sha: "abc1234567890abcdef1234567890abcdef12345",
    } as never);

    const uri = vscode.Uri.file("/repo/src/app.ts") as vscode.Uri;
    await gitCompareWithRevision(
      context,
      uri,
      undefined,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );

    expect(mockLogFile).toHaveBeenCalledWith("/repo", "src/app.ts", {
      limit: 50,
    });
    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        relativePath: "src/app.ts",
        title: expect.stringContaining("abc1234"),
      }),
      undefined,
      expect.objectContaining({
        openInActiveColumn: undefined,
        reusePanel: undefined,
      }),
    );
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
      "vscode.diff",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("gitCompareWithRevision uses the clicked file repository in multi-root workspaces", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
      label: "abc1234",
      description: "Fix bug",
      detail: "Jane",
      sha: "abc1234567890abcdef1234567890abcdef12345",
    } as never);

    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;
    await gitCompareWithRevision(
      context,
      uri,
      undefined,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );

    expect(mockFindRepoRoot).toHaveBeenCalledWith("/repo-b/src/app.ts");
    expect(mockLogFile).toHaveBeenCalledWith("/repo-b", "src/app.ts", {
      limit: 50,
    });
    expect(mockLogFile).not.toHaveBeenCalledWith(
      "/repo",
      expect.any(String),
      expect.anything(),
    );
  });

  it("gitCompareWithBranch opens GitView diff panel when a branch is picked", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(
      "feature" as never,
    );
    const uri = vscode.Uri.file("/repo/src/app.ts") as vscode.Uri;

    await gitCompareWithBranch(
      context,
      uri,
      undefined,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );

    expect(mockListBranches).toHaveBeenCalledWith("/repo");
    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        relativePath: "src/app.ts",
        title: expect.stringContaining("feature"),
      }),
      undefined,
      expect.objectContaining({
        openInActiveColumn: undefined,
        reusePanel: undefined,
      }),
    );
  });

  it("gitShowRevisionDiff opens GitView diff panel between parent and commit", async () => {
    mockFindRepoRoot.mockResolvedValue("/repo");
    mockExecFilePromise.mockResolvedValue({
      stdout: "parent1234567890abcdef1234567890abcdef123456\n",
      stderr: "",
    });

    await gitShowRevisionDiff(
      context,
      "abc1234567890abcdef1234567890abcdef12345",
      "src/app.ts",
      "/repo",
      undefined,
      undefined,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );

    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        relativePath: "src/app.ts",
        title: expect.stringContaining("abc1234"),
      }),
      "/repo",
      expect.objectContaining({
        openInActiveColumn: undefined,
        reusePanel: undefined,
      }),
    );
  });

  it("runGitMenuAction dispatches showRevisionDiff to GitView diff panel", async () => {
    mockFindRepoRoot.mockResolvedValue("/repo");
    mockExecFilePromise.mockResolvedValue({
      stdout: "parent1234567890abcdef1234567890abcdef123456\n",
      stderr: "",
    });

    await runGitMenuAction(
      context,
      {
        action: "showRevisionDiff",
        commitSha: "abc1234567890abcdef1234567890abcdef12345",
        relativePath: "src/app.ts",
      },
      "/repo",
      undefined,
      mockGitView,
    );

    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ relativePath: "src/app.ts" }),
      "/repo",
      expect.objectContaining({
        openInActiveColumn: undefined,
        reusePanel: undefined,
      }),
    );
  });

  it("passes active-column option for annotate revision diffs", async () => {
    mockFindRepoRoot.mockResolvedValue("/repo");
    mockExecFilePromise.mockResolvedValue({
      stdout: "parent1234567890abcdef1234567890abcdef123456\n",
      stderr: "",
    });

    await runGitMenuAction(
      context,
      {
        action: "showRevisionDiff",
        commitSha: "abc1234567890abcdef1234567890abcdef12345",
        relativePath: "src/app.ts",
        openInActiveColumn: true,
      },
      "/repo",
      undefined,
      mockGitView,
    );

    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ relativePath: "src/app.ts" }),
      "/repo",
      expect.objectContaining({ openInActiveColumn: true }),
    );
  });

  it("gitCompareWithBranch lists branches from the clicked file repository", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(
      "feature" as never,
    );
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitCompareWithBranch(
      context,
      uri,
      undefined,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );

    expect(mockListBranches).toHaveBeenCalledWith("/repo-b");
    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        relativePath: "src/app.ts",
        title: expect.stringContaining("feature"),
      }),
      undefined,
      expect.objectContaining({
        openInActiveColumn: undefined,
        reusePanel: undefined,
      }),
    );
  });
});
