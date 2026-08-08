// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GitWidget } from "../GitWidget";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";

const baseRepo: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "feature/login",
  headSha: "abc123456789",
  upstream: "origin/feature/login",
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" },
  ahead: 2,
  behind: 1,
  conflictCount: 0,
  dirty: true,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: Date.now(),
};

const snapshot: RepositorySnapshot = {
  repositories: [baseRepo],
  activeRepoId: "repo-1",
  multiRootDiverged: false,
};

describe("GitWidget", () => {
  afterEach(() => cleanup());

  it("shows branch name and incoming/outgoing counts", () => {
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("branch-name").textContent).toContain("feature/login");
    expect(screen.getByTestId("sync-counts").textContent).toContain("↑2");
    expect(screen.getByTestId("sync-counts").textContent).toContain("↓1");
  });

  it("shows protected branch badge", () => {
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={{ ...baseRepo, protectedBranch: true, currentBranch: "main" }}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
      />,
    );
    expect(screen.getByTestId("protected-branch-badge")).toBeTruthy();
  });

  it("warns when multi-root branches diverge", () => {
    render(
      <GitWidget
        snapshot={{ ...snapshot, multiRootDiverged: true }}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("multi-root-warning")).toBeTruthy();
  });

  it("shows active Git operation state", () => {
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={{
          ...baseRepo,
          operation: { type: "merge", canContinue: false, canAbort: true },
        }}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("operation-badge").textContent).toContain(
      "Merge in progress",
    );
  });

  it("shows detached HEAD label when not on a branch", () => {
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={{
          ...baseRepo,
          currentBranch: null,
          isDetached: true,
        }}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("branch-name").textContent).toContain("Detached");
  });

  it("shows update all roots action for multi-root workspaces", () => {
    const onUpdateAllRoots = vi.fn();
    render(
      <GitWidget
        snapshot={{
          ...snapshot,
          repositories: [baseRepo, { ...baseRepo, id: "repo-2", name: "repo-2" }],
        }}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        onUpdateAllRoots={onUpdateAllRoots}
      />,
    );

    fireEvent.click(screen.getByTestId("update-all-roots-button"));
    expect(onUpdateAllRoots).toHaveBeenCalledTimes(1);
  });

  it("exposes fetch, pull, and push sync actions", () => {
    const onFetch = vi.fn();
    const onPull = vi.fn();
    const onPush = vi.fn();
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={onFetch}
        onPull={onPull}
        onPush={onPush}
      />,
    );

    fireEvent.click(screen.getByTestId("fetch-button"));
    fireEvent.click(screen.getByTestId("pull-button"));
    fireEvent.click(screen.getByTestId("push-button"));
    expect(onFetch).toHaveBeenCalledTimes(1);
    expect(onPull).toHaveBeenCalledWith("merge");
    expect(onPush).toHaveBeenCalledTimes(1);
  });
});