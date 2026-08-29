// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GitWidget } from "../GitWidget";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";
import type { SyncOperationEvent } from "@gitview/shared/types/sync";

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
  changeDigest: null,
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

const runningFetch: SyncOperationEvent = {
  operationId: "sync-1",
  requestId: "fetch-1",
  operation: "fetch",
  repoIds: [baseRepo.id],
  sequence: 2,
  timestamp: 1,
  state: "running",
  phase: "fetching",
  cancellable: true,
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
    expect(screen.getByTestId("fetch-button").textContent).toContain("Fetch");
    expect(screen.getByTestId("fetch-button").querySelector("span")?.className).toContain(
      "max-[400px]:hidden",
    );
    expect(onFetch).toHaveBeenCalledTimes(1);
    expect(onPull).toHaveBeenCalledWith("merge");
    expect(onPush).toHaveBeenCalledTimes(1);
  });

  it("shows host-authoritative fetch progress and cancellation", () => {
    const onCancelSync = vi.fn();
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        syncing
        syncOperation={runningFetch}
        onCancelSync={onCancelSync}
      />,
    );

    expect(screen.getByTestId("sync-operation-status").textContent).toContain(
      "Fetching remote updates",
    );
    expect(screen.getByTestId("fetch-button")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByTestId("sync-operation-cancel"));
    expect(onCancelSync).toHaveBeenCalledTimes(1);
  });

  it("keeps a timed-out request visibly active until a terminal event", () => {
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        syncing
        syncOperation={runningFetch}
        syncOutcomeUnknown
      />,
    );

    expect(screen.getByTestId("sync-operation-status").textContent).toContain(
      "Waiting for the extension host to confirm the final outcome.",
    );
    expect(screen.getByTestId("fetch-button")).toHaveProperty("disabled", true);
  });

  it("offers retry and dismiss after a structured fetch failure", () => {
    const onRetrySync = vi.fn();
    const onDismissSync = vi.fn();
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        syncOperation={{
          ...runningFetch,
          sequence: 3,
          state: "failed",
          outcome: { kind: "offline", message: "Network is offline." },
        }}
        onRetrySync={onRetrySync}
        onDismissSync={onDismissSync}
      />,
    );

    expect(screen.getByTestId("sync-operation-status").textContent).toContain(
      "Network is offline.",
    );
    expect(screen.getByTestId("fetch-button")).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByTestId("sync-operation-retry"));
    fireEvent.click(screen.getByTestId("sync-operation-dismiss"));
    expect(onRetrySync).toHaveBeenCalledTimes(1);
    expect(onDismissSync).toHaveBeenCalledTimes(1);
  });

  it("shows exact per-root progress for update-all operations", () => {
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        syncing
        syncOperation={{
          ...runningFetch,
          operation: "update_all_roots",
          repoIds: [baseRepo.id, "repo-2"],
          progress: {
            completed: 1,
            total: 2,
            roots: [
              {
                repoId: baseRepo.id,
                name: baseRepo.name,
                state: "succeeded",
                outcome: { kind: "success" },
              },
              {
                repoId: "repo-2",
                name: "repo-two",
                state: "skipped",
                outcome: {
                  kind: "no_upstream",
                  message: "No upstream branch.",
                  branch: "main",
                  remote: "origin",
                },
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByTestId("sync-operation-progress").textContent).toBe(
      "1/2 roots",
    );
    expect(screen.getByTestId("sync-root-status-repo-1").textContent).toContain(
      "Updated",
    );
    expect(screen.getByTestId("sync-root-status-repo-2").textContent).toContain(
      "Skipped: No upstream branch.",
    );
  });

  it("offers a Changes destination for pull conflicts", () => {
    const onShowSyncChanges = vi.fn();
    render(
      <GitWidget
        snapshot={snapshot}
        activeRepo={baseRepo}
        onRefresh={vi.fn()}
        onFetch={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        syncOperation={{
          ...runningFetch,
          operation: "pull",
          sequence: 3,
          state: "failed",
          outcome: {
            kind: "conflicts",
            message: "Resolve conflicts before continuing.",
            paths: ["src/app.ts"],
          },
        }}
        onShowSyncChanges={onShowSyncChanges}
      />,
    );

    fireEvent.click(screen.getByTestId("sync-operation-show-changes"));
    expect(onShowSyncChanges).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("sync-operation-retry")).toBeNull();
  });
});