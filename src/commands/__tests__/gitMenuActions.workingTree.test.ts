import "./gitMenuActions.testSetup";
import { describe, it, expect, vi } from "vitest";
import * as vscode from "vscode";
import {
  gitCherryPick,
  gitCheckoutRevision,
  gitRollback,
  gitOpenFile,
  gitAdd,
  gitShowDiff,
  gitUnstage,
  gitFetch,
  gitPull,
  gitPush,
  gitStash,
  gitUnstash,
  gitSync,
} from "../gitMenuActions";
import {
  context,
  mockExecFilePromise,
  mockGitMenuPresentation,
  mockOpenGitViewPanel,
} from "./gitMenuActions.testSetup";

describe("gitMenuActions working tree and sync", () => {
  it("gitCherryPick is a no-op when the user cancels", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    await gitCherryPick("abc1234567890abcdef1234567890abcdef12345", "/repo");

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "status", "--porcelain=v1"],
      { cwd: "/repo" },
    );
    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      ["--no-pager", "cherry-pick", "abc1234567890abcdef1234567890abcdef12345"],
      expect.anything(),
    );
  });

  it("gitCherryPick runs only after confirmation", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Cherry-Pick" as never,
    );

    await gitCherryPick("abc1234567890abcdef1234567890abcdef12345", "/repo");

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "cherry-pick", "abc1234567890abcdef1234567890abcdef12345"],
      { cwd: "/repo" },
    );
  });

  it("gitCheckoutRevision is a no-op when the user cancels", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    await gitCheckoutRevision(
      "abc1234567890abcdef1234567890abcdef12345",
      "/repo",
    );

    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      [
        "--no-pager",
        "checkout",
        "--detach",
        "abc1234567890abcdef1234567890abcdef12345",
      ],
      expect.anything(),
    );
  });

  it("gitRollback discards only after the user confirms", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Rollback" as never,
    );
    const uri = vscode.Uri.file("/repo/src/app.ts") as vscode.Uri;

    await gitRollback(uri, "/repo");

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "restore", "--worktree", "--", "src/app.ts"],
      { cwd: "/repo" },
    );
  });

  it("gitRollback is a no-op when the user cancels", async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );
    await gitRollback(vscode.Uri.file("/repo/src/app.ts") as vscode.Uri);
    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      ["--no-pager", "restore", "--worktree", "--", "src/app.ts"],
      expect.anything(),
    );
  });

  it("gitOpenFile warns instead of opening a missing worktree file", async () => {
    vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(
      new Error("ENOENT"),
    );

    await gitOpenFile("src/missing.ts", "/repo");

    expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("not present on disk"),
    );
  });

  it("gitAdd stages the resolved file URI", async () => {
    const uri = vscode.Uri.file("/repo/src/app.ts") as vscode.Uri;
    await gitAdd(uri);
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "add", "--", "src/app.ts"],
      { cwd: "/repo" },
    );
  });

  it("gitShowDiff opens GitView diff panel for the right-clicked file", async () => {
    const uri = vscode.Uri.file("/repo/src/app.ts") as vscode.Uri;
    await gitShowDiff(
      context,
      uri,
      undefined,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );
    expect(mockOpenGitViewPanel).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        relativePath: "src/app.ts",
        title: expect.stringContaining("HEAD"),
      }),
      undefined,
      expect.objectContaining({
        openInActiveColumn: undefined,
        reusePanel: undefined,
      }),
    );
  });

  it("gitUnstage unstages the resolved file path in the right repository", async () => {
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;
    await gitUnstage(uri);
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "reset", "HEAD", "--", "src/app.ts"],
      { cwd: "/repo-b" },
    );
  });

  it.each([
    ["gitFetch", gitFetch, ["fetch", "origin"]],
    ["gitPull", gitPull, ["pull", "origin", "--no-rebase"]],
    ["gitPush", gitPush, ["push"]],
  ] as const)(
    "%s runs Git CLI in the right-clicked file repository",
    async (_, fn, args) => {
      const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

      await fn(uri);

      expect(mockExecFilePromise).toHaveBeenCalledWith(
        "git",
        ["--no-pager", ...args],
        { cwd: "/repo-b" },
      );
    },
  );

  function mockGitOutput(match: (args: string[]) => string | undefined): void {
    mockExecFilePromise.mockImplementation(
      async (_bin: string, args: string[]) => ({
        stdout: match(args) ?? "",
        stderr: "",
      }),
    );
  }

  const DIRTY_STATUS = " M src/app.ts\n";

  it("gitStash is a no-op when the worktree is clean", async () => {
    await gitStash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "No local changes to stash.",
    );
    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["stash"]),
      expect.anything(),
    );
  });

  it("gitStash passes the message and picked options to git stash push", async () => {
    mockGitOutput((args) =>
      args.includes("status") ? DIRTY_STATUS : "main\n",
    );
    vi.mocked(vscode.window.showInputBox).mockResolvedValue("wip work");
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue([
      { label: "Keep index" },
      { label: "Include untracked files" },
    ] as never);

    await gitStash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "push", "-m", "wip work", "-u", "--keep-index"],
      { cwd: "/repo-b" },
    );
  });

  it("gitStash opens the panel dialog instead of prompting when one is available", async () => {
    mockGitOutput((args) =>
      args.includes("status") ? DIRTY_STATUS : "main\n",
    );
    const openPanelDialog = vi.fn().mockResolvedValue(undefined);

    await gitStash(
      vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri,
      undefined,
      undefined,
      { openPanelDialog } as never,
    );

    expect(openPanelDialog).toHaveBeenCalledWith({
      dialog: "stash",
      relativePath: "src/app.ts",
    });
    expect(vscode.window.showInputBox).not.toHaveBeenCalled();
  });

  it("gitStash scopes to the right-clicked file when that option is picked", async () => {
    mockGitOutput((args) =>
      args.includes("status") ? DIRTY_STATUS : "main\n",
    );
    vi.mocked(vscode.window.showInputBox).mockResolvedValue("");
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue([
      { label: "Only src/app.ts" },
    ] as never);

    await gitStash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "push", "--", "src/app.ts"],
      { cwd: "/repo-b" },
    );
  });

  it("gitStash does not run when the message prompt is dismissed", async () => {
    mockGitOutput((args) =>
      args.includes("status") ? DIRTY_STATUS : "main\n",
    );
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);

    await gitStash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["push"]),
      expect.anything(),
    );
  });

  const STASH_LIST_LINE = [
    "stash@{0}",
    "WIP on main: abc1234 my work",
    "abcdef0",
    "2026-01-01T00:00:00Z",
    "2 hours ago",
  ].join("\0");

  function mockStashList(): void {
    mockGitOutput((args) => {
      if (args.includes("list")) {
        return STASH_LIST_LINE;
      }
      return args.includes("status") ? DIRTY_STATUS : "main\n";
    });
  }

  /** Selects the stash row, then the action row by its id. */
  function pickStashThen(actionId: string): void {
    vi.mocked(vscode.window.showQuickPick)
      .mockImplementationOnce(async (items) => (await items)[0] as never)
      .mockImplementationOnce(async (items) =>
        ((await items) as unknown as { id: string }[]).find(
          (item) => item.id === actionId,
        ) as never,
      );
  }

  it("gitUnstash tells the user when there is nothing to restore", async () => {
    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "No stashed changes to restore.",
    );
  });

  it("gitUnstash opens the panel dialog even with no stashes to restore", async () => {
    const openPanelDialog = vi.fn().mockResolvedValue(undefined);

    await gitUnstash(
      vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri,
      undefined,
      undefined,
      { openPanelDialog } as never,
    );

    expect(openPanelDialog).toHaveBeenCalledWith({ dialog: "unstash" });
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it("gitUnstash applies the selected stash", async () => {
    mockStashList();
    pickStashThen("apply");

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "apply", "stash@{0}"],
      { cwd: "/repo-b" },
    );
  });

  it("gitUnstash pops with --index when reinstating the index", async () => {
    mockStashList();
    pickStashThen("popReinstateIndex");

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "pop", "--index", "stash@{0}"],
      { cwd: "/repo-b" },
    );
  });

  it("gitUnstash creates a branch from the stash", async () => {
    mockStashList();
    pickStashThen("branch");
    vi.mocked(vscode.window.showInputBox).mockResolvedValue("feature/from-stash");

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "branch", "feature/from-stash", "stash@{0}"],
      { cwd: "/repo-b" },
    );
  });

  it("gitUnstash requires confirmation before dropping a stash", async () => {
    mockStashList();
    pickStashThen("drop");
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "drop", "stash@{0}"],
      expect.anything(),
    );

    pickStashThen("drop");
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Drop Stash" as never,
    );

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "drop", "stash@{0}"],
      { cwd: "/repo-b" },
    );
  });

  it("gitUnstash clears every stash after confirmation", async () => {
    mockStashList();
    vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(
      async (items) =>
        ((await items) as unknown as { clear?: boolean }[]).find(
          (item) => item.clear,
        ) as never,
    );
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Clear Stashes" as never,
    );

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "stash", "clear"],
      { cwd: "/repo-b" },
    );
  });

  it("gitUnstash only offers View when a presentation is available", async () => {
    mockStashList();
    pickStashThen("apply");

    await gitUnstash(vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri);

    const withoutPresentation = vi.mocked(vscode.window.showQuickPick).mock
      .calls[1]![0] as unknown as { id: string }[];
    expect(withoutPresentation.map((item) => item.id)).not.toContain("view");

    vi.mocked(vscode.window.showQuickPick).mockReset();
    pickStashThen("apply");

    await gitUnstash(
      vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri,
      undefined,
      undefined,
      mockGitMenuPresentation,
    );

    const withPresentation = vi.mocked(vscode.window.showQuickPick).mock
      .calls[1]![0] as unknown as { id: string }[];
    expect(withPresentation.map((item) => item.id)).toContain("view");
  });

  it("gitSync pulls then pushes in the right-clicked file repository", async () => {
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;
    await gitSync(uri);
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "pull", "origin", "--no-rebase"],
      { cwd: "/repo-b" },
    );
    expect(mockExecFilePromise).toHaveBeenCalledWith(
      "git",
      ["--no-pager", "push"],
      { cwd: "/repo-b" },
    );
  });

  it("gitSync does not push when pull fails", async () => {
    mockExecFilePromise.mockRejectedValueOnce(new Error("pull conflict"));
    const uri = vscode.Uri.file("/repo-b/src/app.ts") as vscode.Uri;

    await gitSync(uri);

    expect(mockExecFilePromise).toHaveBeenCalledTimes(1);
    expect(mockExecFilePromise).not.toHaveBeenCalledWith(
      "git",
      ["--no-pager", "push"],
      expect.anything(),
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("pull conflict"),
    );
  });
});
