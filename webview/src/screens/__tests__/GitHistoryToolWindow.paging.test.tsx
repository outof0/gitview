// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const clientMock = vi.hoisted(() => ({
  queryLog: vi.fn(),
  queryLogDag: vi.fn(() =>
    Promise.resolve({
      repoId: "test-repo",
      headSha: "aaa",
      refTips: ["aaa"],
      nodes: [],
      generatedAt: 0,
    }),
  ),
  logFileDiff: vi.fn(),
  gitMenuAction: vi.fn(),
  commitDetail: vi.fn(),
}));

vi.mock("../../protocol/client", () => ({
  createProtocolClient: () => clientMock,
}));

import type { GitChangedFile, GitCommitEntry } from "@gitview/types";
import { GitHistoryToolWindow } from "../GitHistoryToolWindow";
import { useGitHistoryStore } from "../../stores/gitHistoryStore";
import { setupMergeTestBootstrap } from "../../test/mergeTestProviders";

function commit(
  sha: string,
  parentShas: string[] = [],
  changedFiles: GitChangedFile[] = [],
  author = "Jane",
): GitCommitEntry {
  return {
    sha,
    shortSha: sha,
    author,
    authorEmail: "jane@example.com",
    authorTime: 1_700_000_000,
    subject: `Commit ${sha}`,
    parentShas,
    changedFiles,
  };
}

function snapshot(sha: string, hasMore = false, skip = 0) {
  return {
    repoId: "test-repo",
    branch: "main",
    refreshedAt: 0,
    hasMore,
    filters: { path: "src/app.ts", skip },
    commits: [commit(sha)],
  };
}

const baseState = {
  path: "src/app.ts",
  isFolder: false,
  repoId: "test-repo" as string | null,
  repoRoot: null,
  branches: [] as string[],
  branchFilter: "",
  searchQuery: "",
  authorFilter: "",
  branchTreeOpen: false,
  showDiffPreview: true,
  showDetails: true,
  loading: false,
  hasMore: true,
  loadingMore: false,
  error: null,
  commits: [] as GitCommitEntry[],
  selectedSha: null as string | null,
  selectedChangedFilePath: null as string | null,
  fileDiff: null,
  patchLoading: false,
  patchError: null,
  annotateMode: false,
  commitDetailLoading: false,
};

function seed(overrides: Partial<typeof baseState>): void {
  useGitHistoryStore.setState({ ...baseState, ...overrides });
}

function mockScroll(
  element: HTMLElement,
  sizes: { scrollHeight: number; clientHeight: number; scrollTop: number },
): void {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: sizes.scrollHeight },
    clientHeight: { configurable: true, value: sizes.clientHeight },
    scrollTop: {
      configurable: true,
      writable: true,
      value: sizes.scrollTop,
    },
  });
}

describe("GitHistoryToolWindow loading and paging", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    setupMergeTestBootstrap("test-repo");
    clientMock.queryLog.mockReset();
    clientMock.queryLog.mockResolvedValue(snapshot("host", false));
    clientMock.logFileDiff.mockReset();
    clientMock.logFileDiff.mockResolvedValue({
      layout: "split",
      status: "M",
      left: { label: "left", text: "" },
      right: { label: "right", text: "" },
    });
    clientMock.gitMenuAction.mockReset();
    clientMock.gitMenuAction.mockResolvedValue({});
    clientMock.commitDetail.mockReset();
    clientMock.commitDetail.mockResolvedValue({});
    seed({ commits: [] });
  });

  it("loads an older page when scrolled near the bottom", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({ commits: [first], hasMore: true });
    clientMock.queryLog.mockResolvedValueOnce(snapshot("bbb", false, 1));

    render(<GitHistoryToolWindow />);
    const scroll = screen.getByTestId("git-history-commits-scroll");
    mockScroll(scroll, { scrollHeight: 800, clientHeight: 400, scrollTop: 400 });

    fireEvent.scroll(scroll);

    await waitFor(() =>
      expect(clientMock.queryLog).toHaveBeenCalledWith(
        "test-repo",
        expect.objectContaining({ path: "src/app.ts", limit: 200, skip: 1 }),
      ),
    );
    await waitFor(() =>
      expect(useGitHistoryStore.getState().commits.map((c) => c.sha)).toEqual([
        "aaa",
        "bbb",
      ]),
    );
    expect(useGitHistoryStore.getState().loadingMore).toBe(false);
  });

  it("surfaces a paging failure and clears the spinner", async () => {
    seed({ commits: [commit("aaa")], hasMore: true });
    clientMock.queryLog.mockRejectedValueOnce(new Error("boom"));

    render(<GitHistoryToolWindow />);
    const scroll = screen.getByTestId("git-history-commits-scroll");
    mockScroll(scroll, { scrollHeight: 800, clientHeight: 400, scrollTop: 400 });
    fireEvent.scroll(scroll);

    await waitFor(() =>
      expect(useGitHistoryStore.getState().error).toContain("boom"),
    );
    expect(useGitHistoryStore.getState().loadingMore).toBe(false);
  });

  it("does not page when the log has no next page", async () => {
    seed({ commits: [commit("aaa")], hasMore: false });

    render(<GitHistoryToolWindow />);
    const scroll = screen.getByTestId("git-history-commits-scroll");
    mockScroll(scroll, { scrollHeight: 800, clientHeight: 400, scrollTop: 400 });
    fireEvent.scroll(scroll);
    await act(async () => Promise.resolve());

    expect(clientMock.queryLog).not.toHaveBeenCalled();
  });

  it("loads the history snapshot while the shell is loading", async () => {
    seed({ loading: true, commits: [] });
    clientMock.queryLog.mockResolvedValueOnce(snapshot("aaa", true));

    render(<GitHistoryToolWindow />);

    await waitFor(() =>
      expect(clientMock.queryLog).toHaveBeenCalledWith(
        "test-repo",
        expect.objectContaining({ path: "src/app.ts", limit: 200 }),
      ),
    );
    await waitFor(() =>
      expect(useGitHistoryStore.getState().commits.map((c) => c.sha)).toEqual([
        "aaa",
      ]),
    );
  });

  it("reports the history query error", async () => {
    seed({ loading: true, commits: [] });
    clientMock.queryLog.mockRejectedValueOnce(new Error("nope"));

    render(<GitHistoryToolWindow />);

    await waitFor(() =>
      expect(useGitHistoryStore.getState().error).toContain("nope"),
    );
  });

  it("loads the inline diff when a patch is pending", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
      patchLoading: true,
    });
    clientMock.logFileDiff.mockResolvedValueOnce({
      layout: "split",
      status: "M",
      left: { label: "aaa", text: "" },
      right: { label: "bbb", text: "" },
    });

    render(<GitHistoryToolWindow />);

    await waitFor(() =>
      expect(clientMock.logFileDiff).toHaveBeenCalledWith(
        "test-repo",
        "aaa",
        "src/app.ts",
        "M",
      ),
    );
    await waitFor(() =>
      expect(useGitHistoryStore.getState().patchLoading).toBe(false),
    );
  });

  it("reports the inline diff error", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
      patchLoading: true,
    });
    clientMock.logFileDiff.mockRejectedValueOnce(new Error("diff boom"));

    render(<GitHistoryToolWindow />);

    await waitFor(() =>
      expect(useGitHistoryStore.getState().patchError).toContain("diff boom"),
    );
  });

  it("selects a commit and requests detail in annotate mode", async () => {
    const first = commit("aaa", [], [{ path: "src/app.ts", status: "M" }]);
    seed({ commits: [first], annotateMode: true, loading: false });
    clientMock.commitDetail.mockResolvedValueOnce({ commit: first });

    render(<GitHistoryToolWindow currentSha="aaa" twoPaneLayout />);
    fireEvent.click(screen.getByTestId("git-commit-aaa"));

    await waitFor(() =>
      expect(clientMock.commitDetail).toHaveBeenCalledWith("test-repo", "aaa"),
    );
  });

  it("updates search, branch and author filters", () => {
    seed({
      commits: [commit("aaa", [], [], "Alice")],
      branches: ["main"],
    });
    render(<GitHistoryToolWindow />);

    fireEvent.change(screen.getByTestId("git-history-search"), {
      target: { value: "fix" },
    });
    expect(useGitHistoryStore.getState().searchQuery).toBe("fix");

    fireEvent.change(screen.getByTestId("git-history-branch-filter"), {
      target: { value: "main" },
    });
    expect(useGitHistoryStore.getState().branchFilter).toBe("main");

    fireEvent.change(screen.getByTestId("git-history-author-filter"), {
      target: { value: "Alice" },
    });
    expect(useGitHistoryStore.getState().authorFilter).toBe("Alice");
  });

  it("toggles the branch tree and selects a branch", () => {
    seed({
      commits: [commit("aaa")],
      branches: ["main", "feature"],
      branchFilter: "main",
    });
    render(<GitHistoryToolWindow />);

    fireEvent.click(screen.getByTestId("git-history-toggle-branches"));
    fireEvent.click(screen.getByText("Local"));
    fireEvent.click(screen.getByTestId("log-branch-feature"));

    expect(useGitHistoryStore.getState().branchFilter).toBe("feature");
  });

  it("opens the diff preview when a changed file is selected", () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      showDiffPreview: false,
    });
    render(<GitHistoryToolWindow />);

    fireEvent.click(screen.getByTestId("changed-files-file-src/app.ts"));

    expect(useGitHistoryStore.getState().showDiffPreview).toBe(true);
    expect(useGitHistoryStore.getState().selectedChangedFilePath).toBe(
      "src/app.ts",
    );
  });

  it("routes commit and file context menu actions", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);

    fireEvent.contextMenu(screen.getByTestId("git-commit-aaa"), {
      clientX: 5,
      clientY: 5,
    });
    expect(screen.getByTestId("git-history-commit-context-menu")).toBeTruthy();
    fireEvent.click(screen.getByTestId("git-history-menu-cherry-pick"));
    await waitFor(() =>
      expect(clientMock.gitMenuAction).toHaveBeenCalledWith(
        "test-repo",
        expect.objectContaining({ action: "cherryPick", commitSha: "aaa" }),
      ),
    );

    fireEvent.contextMenu(
      screen.getByTestId("changed-files-file-src/app.ts"),
      { clientX: 6, clientY: 6 },
    );
    expect(screen.getByTestId("git-history-file-context-menu")).toBeTruthy();
    fireEvent.click(screen.getByTestId("git-history-file-menu-show-diff"));
    await waitFor(() =>
      expect(clientMock.gitMenuAction).toHaveBeenCalledWith(
        "test-repo",
        expect.objectContaining({
          action: "showRevisionDiff",
          relativePath: "src/app.ts",
          commitSha: "aaa",
        }),
      ),
    );
  });

  it("opens the revision diff with Command/Ctrl+D", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);

    fireEvent.keyDown(window, { key: "d", metaKey: true });

    await waitFor(() =>
      expect(clientMock.gitMenuAction).toHaveBeenCalledWith(
        "test-repo",
        expect.objectContaining({
          action: "showRevisionDiff",
          relativePath: "src/app.ts",
          commitSha: "aaa",
        }),
      ),
    );
  });

  it("ignores unrelated modification shortcuts", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);

    fireEvent.keyDown(window, { key: "x" });
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "d", metaKey: true, shiftKey: true });
    fireEvent.keyDown(screen.getByTestId("git-history-search"), {
      key: "d",
      metaKey: true,
    });
    await act(async () => Promise.resolve());

    expect(clientMock.gitMenuAction).not.toHaveBeenCalled();
  });

  it("dispatches nothing without a repository and refreshes the shell", async () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      repoId: null,
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);

    fireEvent.keyDown(window, { key: "d", metaKey: true });
    expect(clientMock.gitMenuAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("git-history-refresh"));
    expect(useGitHistoryStore.getState().loading).toBe(true);
  });

  it("shows the changed-files loading hint while commit detail is pending", () => {
    const first = commit("aaa");
    seed({ commits: [first], selectedSha: "aaa", commitDetailLoading: true });
    render(<GitHistoryToolWindow />);

    expect(screen.getByText("Loading changed files…")).toBeTruthy();
  });

  it("renders the annotate scope header and commit footer", () => {
    const first = commit(
      "aaa",
      ["bbb"],
      [{ path: "src/app.ts", status: "M" }],
    );
    seed({
      commits: [first],
      selectedSha: "aaa",
      selectedChangedFilePath: "src/app.ts",
      annotateMode: true,
    });
    render(<GitHistoryToolWindow twoPaneLayout />);

    expect(screen.getByTestId("git-annotate-scope-header")).toBeTruthy();
    expect(screen.getByTestId("git-annotate-commit-footer")).toBeTruthy();
  });
});
