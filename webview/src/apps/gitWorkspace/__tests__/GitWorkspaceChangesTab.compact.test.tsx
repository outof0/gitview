// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "@gitview/shared/types/repository";
import { GitWorkspaceChangesTab } from "../GitWorkspaceChangesTab";
import { GitWorkspaceCommitPanel } from "../GitWorkspaceCommitPanel";

const repository: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: "abc",
  upstream: "origin/main",
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" },
  ahead: 0,
  behind: 0,
  conflictCount: 0,
  changeDigest: null,
  dirty: true,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    workspaceTab: "changes",
    clientRef: { current: {} },
    syncing: false,
    statusSnapshot: { changelists: [] },
    branchCompareOpen: false,
    selectedFilePath: null,
    commitScope: new Set<string>(),
    diffStagedView: false,
    stashSnapshot: null,
    shelfSnapshot: null,
    visibleFiles: () => [],
    selectedFileConflicted: () => false,
    activeRepo: repository,
    committableFiles: () => [],
    commitMessage: "",
    amend: false,
    signoff: false,
    gpgSign: false,
    author: "",
    runChecks: true,
    runMutation: vi.fn(),
    refresh: vi.fn(),
    loadDiff: vi.fn(),
    setDiffDocument: vi.fn(),
    handleSelectFile: vi.fn(),
    selectFile: vi.fn(),
    handleRollback: vi.fn(),
    toggleCommitScope: vi.fn(),
    setDiffStagedView: vi.fn(),
    openDialog: vi.fn(),
    setCommitMessage: vi.fn(),
    setCommitScope: vi.fn(),
    setAmend: vi.fn(),
    setSignoff: vi.fn(),
    setGpgSign: vi.fn(),
    setAuthor: vi.fn(),
    setRunChecks: vi.fn(),
    setWorkspaceNotification: vi.fn(),
    commit: vi.fn(),
    ...overrides,
  } as never;
}

describe("Git Workspace compact sidebar layout", () => {
  afterEach(() => cleanup());

  it("lets the Changes tree fill a sidebar and hides the side diff under 400px", () => {
    render(<GitWorkspaceChangesTab ctx={ctx()} />);
    const tree = screen.getByTestId("workspace-changes");
    expect(tree.parentElement?.className).toContain("max-form-narrow:w-full");
    expect(screen.getByTestId("workspace-diff-panel").parentElement?.className).toContain(
      "max-form-narrow:hidden",
    );
  });

  it("hides the commit surface under 280px", () => {
    render(<GitWorkspaceCommitPanel ctx={ctx()} />);
    expect(screen.getByTestId("gitview-commit-panel").parentElement?.className).toContain(
      "max-bottom-panel-xs:hidden",
    );
  });

  it("keeps the toolbar full width above a stacked file list and composer", () => {
    render(<GitWorkspaceChangesTab ctx={ctx()} layout="sidebar" />);
    expect(screen.getByTestId("workspace-changes-layout").dataset.layout).toBe(
      "sidebar",
    );
    expect(screen.getByTestId("commit-toolbar")).toBeTruthy();
    expect(screen.getByTestId("commit-toolbar").className).toContain("w-full");
    expect(screen.getByTestId("resizable-split-vertical")).toBeTruthy();
    expect(screen.getByTestId("gitview-commit-panel")).toBeTruthy();
    expect(screen.queryByTestId("workspace-diff-panel")).toBeNull();
  });

  it("opens rollback confirmation in a dialog from the sidebar", () => {
    const openDialog = vi.fn();
    const openRollbackPanel = vi.fn().mockResolvedValue({ opened: true });
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: "src/app.ts",
          visibleFiles: () => [
            {
              repoId: "repo-1",
              path: "src/app.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
          ],
          openDialog,
          clientRef: { current: { openRollbackPanel } },
        })}
        layout="sidebar"
      />,
    );

    fireEvent.click(screen.getByTestId("commit-toolbar-rollback"));
    expect(openDialog).not.toHaveBeenCalled();
    expect(openRollbackPanel).toHaveBeenCalledWith("repo-1", "src/app.ts", [
      "src/app.ts",
    ]);
  });

  it("opens the same rollback dialog from a file context menu", () => {
    const openDialog = vi.fn();
    const openRollbackPanel = vi.fn().mockResolvedValue({ opened: true });
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          visibleFiles: () => [
            {
              repoId: "repo-1",
              path: "src/app.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
          ],
          openDialog,
          clientRef: { current: { openRollbackPanel } },
        })}
        layout="sidebar"
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("change-row-src/app.ts"));
    fireEvent.click(screen.getByTestId("git-menu-rollback"));
    expect(openDialog).not.toHaveBeenCalled();
    expect(openRollbackPanel).toHaveBeenCalledWith("repo-1", "src/app.ts", [
      "src/app.ts",
    ]);
  });

  it("passes every checked change to the content rollback dialog", () => {
    const openRollbackPanel = vi.fn().mockResolvedValue({ opened: true });
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: "src/app.ts",
          commitScope: new Set(["src/app.ts", "src/other.ts"]),
          visibleFiles: () => [
            {
              repoId: "repo-1",
              path: "src/app.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
            {
              repoId: "repo-1",
              path: "src/other.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
            {
              repoId: "repo-1",
              path: "README.md",
              kind: "added",
              indexStatus: "A",
              workingTreeStatus: "A",
              staged: false,
              conflicted: false,
              binary: false,
            },
          ],
          clientRef: { current: { openRollbackPanel } },
        })}
        layout="sidebar"
      />,
    );

    fireEvent.click(screen.getByTestId("commit-toolbar-rollback"));
    expect(openRollbackPanel).toHaveBeenCalledWith("repo-1", "src/app.ts", [
      "src/app.ts",
      "src/other.ts",
    ]);
  });

  it("reports an error when the rollback panel cannot be opened", async () => {
    const openRollbackPanel = vi.fn().mockRejectedValue(
      new Error("The content panel is unavailable."),
    );
    const setWorkspaceNotification = vi.fn();
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: "src/app.ts",
          commitScope: new Set(["src/app.ts", "src/other.ts"]),
          visibleFiles: () => [
            {
              repoId: "repo-1",
              path: "src/app.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
            {
              repoId: "repo-1",
              path: "src/other.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
          ],
          clientRef: { current: { openRollbackPanel } },
          setWorkspaceNotification,
        })}
        layout="sidebar"
      />,
    );

    fireEvent.click(screen.getByTestId("commit-toolbar-rollback"));
    await waitFor(() => expect(openRollbackPanel).toHaveBeenCalledTimes(1));
    expect(setWorkspaceNotification).toHaveBeenCalledWith({
      level: "error",
      message: "The content panel is unavailable.",
    });
  });

  it("keeps the full file list while checking only a selected content file", () => {
    const openDialog = vi.fn();
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: "src/app.ts",
          visibleFiles: () => [
            {
              repoId: "repo-1",
              path: "src/app.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
            {
              repoId: "repo-1",
              path: "README.md",
              kind: "added",
              indexStatus: "A",
              workingTreeStatus: "A",
              staged: false,
              conflicted: false,
              binary: false,
            },
          ],
          openDialog,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("rollback-button"));
    expect(openDialog).toHaveBeenCalledWith("rollbackChanges", {
      paths: ["src/app.ts", "README.md"],
      selectedPaths: ["src/app.ts"],
    });
  });

  it("Ctrl+D opens the working-tree diff for the selected file", async () => {
    const openDiff = vi.fn().mockResolvedValue({
      repoId: "repo-1",
      filePath: "src/a.ts",
      layout: "split",
      status: "M",
      left: { label: "HEAD", text: "before\n" },
      right: { label: "Working Tree", text: "after\n" },
      binary: false,
      staged: false,
    });
    const openDiffInEditor = vi.fn().mockResolvedValue({ ok: true });
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: "src/a.ts",
          clientRef: { current: { openDiff, openDiffInEditor } },
        })}
      />,
    );
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    await waitFor(() =>
      expect(openDiffInEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "a.ts",
          relativePath: "src/a.ts",
          repoId: "repo-1",
        }),
      ),
    );
    expect(openDiff).toHaveBeenCalledWith("repo-1", "src/a.ts", false);
  });

  it("uses the clicked file when Cmd+D arrives before selection state commits", async () => {
    const openDiff = vi.fn().mockResolvedValue({
      repoId: "repo-1",
      filePath: "src/a.ts",
      layout: "split",
      status: "M",
      left: { label: "HEAD", text: "before\n" },
      right: { label: "Working Tree", text: "after\n" },
      binary: false,
      staged: false,
    });
    const openDiffInEditor = vi.fn().mockResolvedValue({ ok: true });
    const handleSelectFile = vi.fn();
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: null,
          handleSelectFile,
          visibleFiles: () => [
            {
              repoId: "repo-1",
              path: "src/a.ts",
              kind: "modified",
              indexStatus: "M",
              workingTreeStatus: "M",
              staged: false,
              conflicted: false,
              binary: false,
            },
          ],
          clientRef: { current: { openDiff, openDiffInEditor } },
        })}
        layout="sidebar"
      />
    );

    const row = screen.getByTestId("change-row-src/a.ts");
    fireEvent.click(row.querySelector("button") as HTMLButtonElement);
    fireEvent.keyDown(window, { key: "d", metaKey: true });

    expect(handleSelectFile).toHaveBeenCalledWith("src/a.ts");
    await waitFor(() => expect(openDiffInEditor).toHaveBeenCalledOnce());
    expect(openDiff).toHaveBeenCalledWith("repo-1", "src/a.ts", false);
  });

  it("keeps a new file's editor diff single-pane", async () => {
    const openDiff = vi.fn().mockResolvedValue({
      repoId: "repo-1",
      filePath: "src/new.ts",
      layout: "single",
      status: "A",
      left: { label: "Empty", text: "" },
      right: { label: "Working Tree", text: "export {}\n" },
      binary: false,
      staged: false,
    });
    const openDiffInEditor = vi.fn().mockResolvedValue({ ok: true });
    render(
      <GitWorkspaceChangesTab
        ctx={ctx({
          selectedFilePath: "src/new.ts",
          clientRef: { current: { openDiff, openDiffInEditor } },
        })}
      />,
    );
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });

    await waitFor(() => expect(openDiffInEditor).toHaveBeenCalledOnce());
    expect(openDiffInEditor.mock.calls[0]?.[0].diff).toMatchObject({
      layout: "single",
      status: "A",
    });
  });
});
