// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogSnapshot } from "@gitview/shared/types/log";
import type { Repository } from "@gitview/shared/types/repository";
import { GitWorkspaceLogTab } from "../GitWorkspaceLogTab";
import type { GitWorkspaceController } from "../gitWorkspaceControllerTypes";
import { useGitWorkspaceStore } from "../../../stores/gitWorkspaceStore";

/**
 * The other half of the render-cost guard.
 *
 * `useGitWorkspaceController` returns a brand-new object on every render, so
 * GitWorkspaceLogTab always re-renders. That is fine and cheap. What is NOT
 * fine is passing freshly-created callbacks down: WorkspaceLogPanel memoizes
 * its commit rows, so one unstable callback re-renders the entire log.
 *
 * This asserts the tab hands the panel the same function identities across a
 * re-render, even though it received a different `ctx`.
 */

const panelSpy = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../components/git/WorkspaceLogPanel", () => ({
  WorkspaceLogPanel: (props: Record<string, unknown>) => {
    panelSpy.calls.push(props);
    return null;
  },
}));

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
  refreshedAt: 0,
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

// Defined once so the only thing that differs between renders is `ctx` itself.
const noop = async () => {};
const clientRef = { current: {} as never };
const logFilters = { range: "all" as const, limit: 200 };
const logSelectedShas: string[] = [];

function makeCtx(overrides: Partial<GitWorkspaceController> = {}): GitWorkspaceController {
  return {
    ...useGitWorkspaceStore.getState(),
    clientRef,
    syncing: false,
    diffDocument: null,
    diffLoading: false,
    diffError: null,
    selectedFilePath: null,
    workspaceTab: "log",
    logSnapshot: snapshot,
    logLoading: false,
    logError: null,
    logSelectedSha: sha,
    logSelectedShas,
    logSelectedFilePath: null,
    logFilters,
    issueTrackerBaseUrl: null,
    branchSnapshot: null,
    activeRepo: repository,
    runMutation: noop,
    loadLog: noop,
    loadLogFileDiff: noop,
    loadBranches: noop,
    handleRewriteHistory: noop,
    handleDropSelected: noop,
    handleReset: noop,
    handleCopyHash: noop,
    ...overrides,
  } as unknown as GitWorkspaceController;
}

function functionProps(props: Record<string, unknown>): string[] {
  return Object.keys(props).filter((key) => typeof props[key] === "function");
}

describe("GitWorkspaceLogTab callback stability", () => {
  beforeEach(() => {
    panelSpy.calls = [];
  });

  it("passes the same handler identities across a re-render with a new ctx", () => {
    const { rerender } = render(<GitWorkspaceLogTab ctx={makeCtx()} />);
    // A different object, exactly as useGitWorkspaceController produces one.
    rerender(<GitWorkspaceLogTab ctx={makeCtx({ syncing: true })} />);

    expect(panelSpy.calls).toHaveLength(2);
    const [first, second] = panelSpy.calls as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];

    const unstable = functionProps(first).filter(
      (key) => !Object.is(first[key], second[key]),
    );

    expect(unstable).toEqual([]);
  });

  it("keeps the derived lists stable when the log snapshot is unchanged", () => {
    const { rerender } = render(<GitWorkspaceLogTab ctx={makeCtx()} />);
    rerender(<GitWorkspaceLogTab ctx={makeCtx({ syncing: true })} />);

    const [first, second] = panelSpy.calls as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(first.branches).toBe(second.branches);
    expect(first.authors).toBe(second.authors);
    expect(first.pathOptions).toBe(second.pathOptions);
  });
});
