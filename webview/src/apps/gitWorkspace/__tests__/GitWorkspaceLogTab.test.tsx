// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { Repository } from "@gitview/shared/types/repository";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import { GitWorkspaceLogTab } from "../GitWorkspaceLogTab";
import { useGitWorkspaceStore } from "../../../stores/gitWorkspaceStore";
import { useDiffPreviewStore } from "../../../stores/diffPreviewStore";

const sha = "abc1234567890abcdef1234567890abcdef1234";

const repository: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: sha,
  upstream: "origin/main",
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" },
  ahead: 0,
  behind: 0,
  conflictCount: 0,
  changeDigest: null,
  dirty: false,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

const snapshot: LogSnapshot = {
  repoId: "repo-1",
  branch: "main",
  refreshedAt: Date.now(),
  commits: [
    {
      sha,
      shortSha: "abc1234",
      author: "Jane",
      authorEmail: "j@example.com",
      authorTime: 1_700_000_000,
      subject: "Fix bug",
      changedFiles: [{ path: "src/Input.tsx", status: "M" }],
    },
  ],
};

const document: WorkspaceDiffDocument = {
  repoId: "repo-1",
  filePath: "src/Input.tsx",
  layout: "split",
  status: "M",
  left: { label: "parent", text: "old" },
  right: { label: "commit", text: "new" },
  binary: false,
  staged: false,
};

describe("GitWorkspaceLogTab file activation", () => {
  afterEach(() => {
    cleanup();
    useDiffPreviewStore.getState().closeDiffPreview();
  });

  it("opens the compare editor tab instead of a modal overlay", async () => {
    const openDiffInEditor = vi.fn().mockResolvedValue({ ok: true });
    const loadLogFileDiff = vi.fn().mockImplementation(async () => {
      useGitWorkspaceStore.getState().setDiffDocument(document);
    });
    useGitWorkspaceStore.setState({ logSelectedSha: sha });

    render(
      <GitWorkspaceLogTab
        ctx={{
          workspaceTab: "log",
          clientRef: { current: { openDiffInEditor } },
          syncing: false,
          diffDocument: null,
          diffLoading: false,
          diffError: null,
          selectedFilePath: null,
          logSnapshot: snapshot,
          logLoading: false,
          logError: null,
          logSelectedSha: sha,
          logSelectedShas: [],
          logSelectedFilePath: null,
          logFilters: { range: "all", limit: 200 },
          issueTrackerBaseUrl: null,
          blameSnapshot: null,
          blameLoading: false,
          blameError: null,
          setLogFilters: vi.fn(),
          openDialog: vi.fn(),
          selectLogCommit: vi.fn(),
          toggleLogCommitSelection: vi.fn(),
          selectLogFile: vi.fn(),
          activeRepo: repository,
          runMutation: vi.fn(),
          loadLog: vi.fn(),
          loadLogFileDiff,
          handleRewriteHistory: vi.fn(),
          handleDropSelected: vi.fn(),
          handleReset: vi.fn(),
          handleCopyHash: vi.fn(),
          branchSnapshot: null,
          loadBranches: vi.fn(),
        } as never}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId("changed-files-file-src/Input.tsx"));

    await waitFor(() => {
      expect(openDiffInEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Input.tsx",
          relativePath: "src/Input.tsx",
          repoId: "repo-1",
        }),
      );
    });
    expect(useDiffPreviewStore.getState().open).toBe(false);
  });
});
