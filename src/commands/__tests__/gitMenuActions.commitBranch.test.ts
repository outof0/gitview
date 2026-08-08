import "./gitMenuActions.testSetup";
import { describe, it, expect, vi } from "vitest";
import * as vscode from "vscode";
import {
  gitCommit,
  gitCommitAndPush,
  gitCheckoutBranch,
  gitCreateBranch,
  gitMerge,
  gitRebase,
  gitShelve,
  gitUnshelve,
  gitGetFromRevision,
} from "../gitMenuActions";
import {
  mockExecFilePromise,
  mockListBranches,
  mockResolveGitRepository,
  mockShelveChanges,
  mockUnshelveLatest,
} from "./gitMenuActions.testSetup";

describe("gitMenuActions commit and branch", () => {
  it("gitCommit prompts for a message when the SCM input box is empty", async () => {
    mockResolveGitRepository.mockResolvedValue({
      rootUri: { fsPath: "/repo-b" },
      inputBox: { value: "" },
    });
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(
      "Typed commit message" as never,
    );
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitCommit(uri);

    expect(vscode.window.showInputBox).toHaveBeenCalled();
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "commit", "-m", "Typed commit message"],
      { cwd: "/repo-b" },
    );
  });

  it("gitCommit commits with the repository input box message", async () => {
    mockResolveGitRepository.mockResolvedValue({
      rootUri: { fsPath: "/repo-b" },
      inputBox: { value: "Explorer commit" },
    });
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitCommit(uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "commit", "-m", "Explorer commit"],
      { cwd: "/repo-b" },
    );
  });

  it("gitCommitAndPush commits and pushes with the repository input box message", async () => {
    mockResolveGitRepository.mockResolvedValue({
      rootUri: { fsPath: "/repo-b" },
      inputBox: { value: "Explorer commit and push" },
    });
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitCommitAndPush(uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "commit", "-m", "Explorer commit and push"],
      { cwd: "/repo-b" },
    );
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "push"],
      { cwd: "/repo-b" },
    );
  });

  it("gitCheckoutBranch switches the selected branch in the right-clicked repository", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(
      "feature" as never,
    );
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitCheckoutBranch(uri);

    expect(mockListBranches).toHaveBeenCalledWith("/repo-b");
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "switch", "feature"],
      { cwd: "/repo-b" },
    );
  });

  it("gitCreateBranch creates and checks out the typed branch in the right-clicked repository", async () => {
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(
      "new-work" as never,
    );
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitCreateBranch(uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "switch", "-c", "new-work"],
      { cwd: "/repo-b" },
    );
  });

  it("gitMerge merges the selected branch into the right-clicked repository", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(
      "feature" as never,
    );
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitMerge(uri);

    expect(mockListBranches).toHaveBeenCalledWith("/repo-b");
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "merge", "feature"],
      { cwd: "/repo-b" },
    );
  });

  it("gitRebase rebases onto the selected branch in the right-clicked repository", async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(
      "feature" as never,
    );
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitRebase(uri);

    expect(mockListBranches).toHaveBeenCalledWith("/repo-b");
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "rebase", "feature"],
      { cwd: "/repo-b" },
    );
  });

  it.each([
    ["gitCreateBranch", gitCreateBranch, "createBranch"],
    ["gitMerge", gitMerge, "merge"],
    ["gitRebase", gitRebase, "rebase"],
    ["gitCommit", gitCommit, "commit"],
    ["gitCommitAndPush", gitCommitAndPush, "commit"],
    ["gitCheckoutBranch", gitCheckoutBranch, "branches"],
  ])(
    "%s opens the panel dialog instead of prompting when one is available",
    async (_name, command, dialog) => {
      const openPanelDialog = vi.fn().mockResolvedValue(undefined);
      const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

      await command(uri, undefined, undefined, { openPanelDialog } as never);

      expect(openPanelDialog).toHaveBeenCalledWith({ dialog });
      expect(vscode.window.showInputBox).not.toHaveBeenCalled();
      expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
      expect(mockExecFilePromise).not.toHaveBeenCalledWith(
        "git",
        expect.arrayContaining(["merge"]),
        expect.anything(),
      );
    },
  );

  it("gitShelve shelves changes scoped to the right-clicked file", async () => {
    mockShelveChanges.mockResolvedValue(true);
    const uri = vscode.Uri.file("/repo-b/README.md") as vscode.Uri;

    await gitShelve(uri);

    expect(mockShelveChanges).toHaveBeenCalledWith("/repo-b", "README.md");
  });

  it("gitUnshelve restores the latest shelf in the right-clicked repository", async () => {
    mockUnshelveLatest.mockResolvedValue(true);
    const uri = vscode.Uri.file("/repo-b/README.md") as vscode.Uri;

    await gitUnshelve(uri);

    expect(mockUnshelveLatest).toHaveBeenCalledWith("/repo-b");
  });

  it("gitGetFromRevision is a no-op when the user cancels", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    await gitGetFromRevision(
      "abc1234567890abcdef1234567890abcdef12345",
      "file.txt",
      "/repo",
    );

    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      [
        "--no-pager",
        "checkout",
        "abc1234567890abcdef1234567890abcdef12345",
        "--",
        "file.txt",
      ],
      expect.anything(),
    );
  });

  it("gitGetFromRevision checks out the revision after confirmation", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Get from Revision" as never,
    );

    await gitGetFromRevision(
      "abc1234567890abcdef1234567890abcdef12345",
      "file.txt",
      "/repo",
    );

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      [
        "--no-pager",
        "checkout",
        "abc1234567890abcdef1234567890abcdef12345",
        "--",
        "file.txt",
      ],
      { cwd: "/repo" },
    );
  });
});