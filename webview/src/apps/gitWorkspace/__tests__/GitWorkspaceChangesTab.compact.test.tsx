// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
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

function ctx() {
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
    handleSelectFile: vi.fn(),
    handleRollback: vi.fn(),
    toggleCommitScope: vi.fn(),
    setDiffStagedView: vi.fn(),
    openDialog: vi.fn(),
    setCommitMessage: vi.fn(),
    setAmend: vi.fn(),
    setSignoff: vi.fn(),
    setGpgSign: vi.fn(),
    setAuthor: vi.fn(),
    setRunChecks: vi.fn(),
    setWorkspaceNotification: vi.fn(),
    commit: vi.fn(),
  } as never;
}

describe("Git Workspace compact sidebar layout", () => {
  afterEach(() => cleanup());

  it("lets the Changes tree fill a sidebar and hides the side diff under 400px", () => {
    render(<GitWorkspaceChangesTab ctx={ctx()} />);
    const tree = screen.getByTestId("workspace-changes");
    expect(tree.parentElement?.className).toContain("max-[400px]:w-full");
    expect(screen.getByTestId("workspace-diff-panel").parentElement?.className).toContain(
      "max-[400px]:hidden",
    );
  });

  it("hides the commit surface under 280px", () => {
    render(<GitWorkspaceCommitPanel ctx={ctx()} />);
    expect(screen.getByTestId("gitview-commit-panel").parentElement?.className).toContain(
      "max-[280px]:hidden",
    );
  });
});
