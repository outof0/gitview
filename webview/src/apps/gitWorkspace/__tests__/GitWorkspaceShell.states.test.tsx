// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "@gitview/shared/types/repository";
import { GitWorkspaceShell } from "../GitWorkspaceShell";

const baseRepository: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: "abc123",
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

function context(activeRepo: Repository | null, loading = false) {
  return {
    clientRef: { current: { collapsePanel: vi.fn() } },
    logFilters: { range: "all", limit: 200 },
    setLogFilters: vi.fn(),
    refreshing: false,
    syncing: false,
    repoSnapshot: activeRepo
      ? {
          repositories: [activeRepo],
          activeRepoId: activeRepo.id,
          multiRootDiverged: false,
        }
      : loading
        ? null
        : { repositories: [], activeRepoId: null, multiRootDiverged: false },
    loading,
    error: null,
    pullStrategy: "merge",
    workspaceTab: "changes",
    workspaceNotification: null,
    activeRepo,
    runMutation: vi.fn(),
    refresh: vi.fn(),
    handlePush: vi.fn(),
    handleUpdateAllRoots: vi.fn(),
  } as never;
}

describe("GitWorkspaceShell repository states", () => {
  afterEach(() => cleanup());

  it("shows loading without rendering workspace tabs", () => {
    render(<GitWorkspaceShell ctx={context(null, true)} />);

    expect(screen.getByTestId("repository-state-loading")).toBeTruthy();
    expect(screen.queryByTestId("workspace-tab-bar")).toBeNull();
  });

  it("shows concrete acquisition actions when no repository exists", () => {
    render(<GitWorkspaceShell ctx={context(null)} />);

    expect(screen.getByTestId("repository-state-none")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Folder" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Clone Repository" }),
    ).toBeTruthy();
    expect(screen.queryByTestId("workspace-tab-bar")).toBeNull();
  });

  it("shows the log panel chrome without recovery banners", () => {
    const repository: Repository = {
      ...baseRepository,
      headSha: null,
      upstream: null,
      headState: { kind: "unborn", branch: "main" },
      remoteState: { kind: "none" },
    };
    render(<GitWorkspaceShell ctx={context(repository)} />);

    expect(screen.queryByTestId("repository-state-unborn")).toBeNull();
    expect(screen.queryByTestId("repository-state-no-remote")).toBeNull();
    expect(screen.queryByTestId("gitview-git-widget")).toBeNull();
    expect(screen.queryByTestId("operation-recovery-bar")).toBeNull();
    expect(screen.getByTestId("workspace-tab-bar")).toBeTruthy();
    expect(screen.getByTestId("workspace-section-select")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Temporary Work" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Review" })).toBeTruthy();
  });

  it("blocks repository content in restricted mode", () => {
    render(
      <GitWorkspaceShell
        ctx={context({ ...baseRepository, trusted: false })}
      />,
    );

    expect(screen.getByTestId("repository-state-untrusted")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Trust" })).toBeTruthy();
    expect(screen.queryByTestId("workspace-tab-bar")).toBeNull();
  });
});
