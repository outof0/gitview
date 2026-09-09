// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeList, GitFileStatus, StatusSnapshot } from "@gitview/shared/types/status";
import type { Repository } from "@gitview/shared/types/repository";
import { GitWorkspaceChangesTab } from "../GitWorkspaceChangesTab";
import type { GitWorkspaceController } from "../gitWorkspaceControllerTypes";
import { useGitWorkspaceStore } from "../../../stores/gitWorkspaceStore";

/**
 * The Changes tab is the one that hurts most: every commit-message keystroke
 * updates the store, and this tab re-renders wholesale because `ctx` is a fresh
 * object each render. Cheap to re-render — unless it hands unstable props down,
 * which defeats the `memo` on FileRow/Section inside WorkspaceChangesPanel.
 *
 * Two distinct leaks are guarded here:
 *  - unstable callbacks (same class of bug as GitWorkspaceLogTab)
 *  - `visibleFiles()` / `committableFiles()` / `changelists` called or rebuilt
 *    inline, which produce a new array identity every render no matter what the
 *    callbacks do
 */

const panelSpy = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../components/git/WorkspaceChangesPanel", () => ({
  WorkspaceChangesPanel: (props: Record<string, unknown>) => {
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
  dirty: true,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

function file(path: string): GitFileStatus {
  return {
    repoId: "repo-1",
    path,
    kind: "modified",
    indexStatus: "M",
    workingTreeStatus: "M",
    staged: false,
    conflicted: false,
    binary: false,
  };
}

const changelist: ChangeList = {
  id: "list-1",
  repoId: "repo-1",
  name: "WIP",
  active: true,
  filePaths: ["src/a.ts"],
  createdAt: 0,
  updatedAt: 0,
};

const statusSnapshot: StatusSnapshot = {
  repoId: "repo-1",
  files: [file("src/a.ts"), file("src/b.ts")],
  changelists: [changelist],
  mode: "changelist",
  showIgnored: false,
  showUnversioned: true,
  refreshedAt: 0,
};

// Defined once: only `ctx` itself may differ between renders.
const noop = async () => {};
const noopVoid = () => {};
const clientRef = { current: {} as never };
const commitScope = new Set(["src/a.ts"]);

function makeCtx(
  overrides: Partial<GitWorkspaceController> = {},
): GitWorkspaceController {
  return {
    ...useGitWorkspaceStore.getState(),
    clientRef,
    syncing: false,
    workspaceTab: "changes",
    statusSnapshot,
    branchCompareSnapshot: null,
    branchCompareOpen: false,
    branchCompareSelectedFile: null,
    diffDocument: null,
    diffLoading: false,
    diffError: null,
    selectedFilePath: "src/a.ts",
    commitScope,
    diffStagedView: false,
    stashSnapshot: null,
    shelfSnapshot: null,
    activeRepo: repository,
    runMutation: noop,
    refresh: noop,
    loadDiff: noop,
    commit: noop,
    handleSelectFile: noopVoid,
    handleBranchCompareFile: noopVoid,
    handleApplyNonConflicting: noopVoid,
    handleRollback: noop,
    ...overrides,
  } as unknown as GitWorkspaceController;
}

function functionProps(props: Record<string, unknown>): string[] {
  return Object.keys(props).filter((key) => typeof props[key] === "function");
}

describe("GitWorkspaceChangesTab callback stability", () => {
  beforeEach(() => {
    panelSpy.calls = [];
  });

  it("passes the same handler identities across a re-render with a new ctx", () => {
    const { rerender } = render(<GitWorkspaceChangesTab ctx={makeCtx()} />);
    // A different object, exactly as useGitWorkspaceController produces one.
    rerender(<GitWorkspaceChangesTab ctx={makeCtx({ syncing: true })} />);

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

  it("keeps derived arrays stable when the status snapshot is unchanged", () => {
    const { rerender } = render(<GitWorkspaceChangesTab ctx={makeCtx()} />);
    rerender(<GitWorkspaceChangesTab ctx={makeCtx({ syncing: true })} />);

    const [first, second] = panelSpy.calls as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(first.files).toBe(second.files);
    expect(first.changelists).toBe(second.changelists);
  });

  it("recomputes the file list when the status snapshot actually changes", () => {
    const { rerender } = render(<GitWorkspaceChangesTab ctx={makeCtx()} />);
    const nextSnapshot: StatusSnapshot = {
      ...statusSnapshot,
      files: [file("src/a.ts"), file("src/b.ts"), file("src/c.ts")],
    };
    rerender(<GitWorkspaceChangesTab ctx={makeCtx({ statusSnapshot: nextSnapshot })} />);

    const [first, second] = panelSpy.calls as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    // Guard against the opposite failure: a memo that never recomputes is worse
    // than no memo at all, because it silently serves stale file lists.
    expect(first.files).not.toBe(second.files);
  });

  it("passes remote availability even when the branch has no upstream", () => {
    const repoWithUntrackedRemote: Repository = {
      ...repository,
      upstream: null,
      ahead: null,
      behind: null,
      remoteState: {
        kind: "available",
        remotes: ["origin"],
        upstream: null,
      },
    };
    render(
      <GitWorkspaceChangesTab
        ctx={makeCtx({ activeRepo: repoWithUntrackedRemote })}
      />,
    );

    expect(panelSpy.calls[0]?.hasRemote).toBe(true);
  });
});
