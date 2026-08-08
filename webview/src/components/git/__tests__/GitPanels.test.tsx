// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GitHistoryToolWindow } from "../../../screens/GitHistoryToolWindow";
import { ChangesFromBranchPanel } from "../ChangesFromBranchPanel";
import { useGitHistoryStore } from "../../../stores/gitHistoryStore";
import { useGitPanelStore } from "../../../stores/gitPanelStore";
import { setupMergeTestBootstrap } from "../../../test/mergeTestProviders";
import { mergeTestOutbound } from "../../../hooks/merge/mergeClientContext";

describe("Git panels", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    setupMergeTestBootstrap("test-repo");
    useGitPanelStore.getState().closeChangesFromSide();
    useGitHistoryStore.setState({
      path: "",
      isFolder: false,
      repoId: null,
      repoRoot: null,
      branches: [],
      branchFilter: "",
      searchQuery: "",
      branchTreeOpen: false,
      showDiffPreview: true,
      showDetails: true,
      annotateMode: false,
      loading: false,
      error: null,
      commits: [],
      selectedSha: null,
      selectedChangedFilePath: null,
      fileDiff: null,
      patchLoading: false,
      patchError: null,
    });
  });

  it("GitHistoryToolWindow renders History tab with branch tree closed by default", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      repoId: "test-repo",
      repoRoot: "/r",
      branches: ["main", "feature", "origin/main"],
      branchFilter: "main",
      authorFilter: "",
      branchTreeOpen: false,
      loading: false,
      commits: [
        {
          sha: "abc",
          shortSha: "abc",
          author: "Jane",
          authorEmail: "j@e.c",
          authorTime: 1_700_000_000,
          subject: "Fix bug",
          parentShas: ["0000001"],
          refs: ["main", "origin/main"],
          changedFiles: [{ path: "src/app.ts", status: "M" }],
        },
      ],
      selectedSha: "abc",
      selectedChangedFilePath: "src/app.ts",
      fileDiff: {
        layout: "split",
        status: "M",
        left: { label: "abc1234", text: "const old = 1;\n" },
        right: { label: "def5678", text: "const next = 2;\n" },
      },
    });
    render(<GitHistoryToolWindow />);
    expect(screen.getByTestId("git-history-tool-window")).toBeTruthy();
    expect(screen.getByText("History: app.ts")).toBeTruthy();
    // Default: commits | files + details — no static branch tree chrome.
    expect(screen.getByTestId("git-history-log-body").getAttribute("data-layout")).toBe(
      "log",
    );
    expect(screen.queryByTestId("log-branch-tree")).toBeNull();
    expect(screen.getByTestId("git-commit-list")).toBeTruthy();
    expect(screen.getByTestId("commit-ref-main")).toBeTruthy();
    expect(screen.getByTestId("git-changed-files-tree")).toBeTruthy();
    expect(screen.getByTestId("git-log-details-pane")).toBeTruthy();
    expect(screen.getByTestId("git-history-branch-filter")).toBeTruthy();
    expect(screen.getByTestId("git-history-author-filter")).toBeTruthy();
    expect(screen.getByTestId("git-history-toggle-branches").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("selecting a changed file enables inline diff preview when it was off", () => {
    useGitHistoryStore.setState({
      path: "src",
      isFolder: true,
      repoId: "test-repo",
      repoRoot: "/r",
      branches: ["main"],
      branchFilter: "main",
      authorFilter: "",
      branchTreeOpen: false,
      showDiffPreview: false,
      annotateMode: false,
      loading: false,
      commits: [
        {
          sha: "abc",
          shortSha: "abc",
          author: "Jane",
          authorEmail: "j@e.c",
          authorTime: 1_700_000_000,
          subject: "Fix bug",
          parentShas: ["0000001"],
          refs: ["main"],
          changedFiles: [
            { path: "src/app.ts", status: "M" },
            { path: "src/other.ts", status: "M" },
          ],
        },
      ],
      selectedSha: "abc",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);
    fireEvent.click(screen.getByTestId("changed-files-file-src/other.ts"));
    expect(useGitHistoryStore.getState().showDiffPreview).toBe(true);
    expect(useGitHistoryStore.getState().selectedChangedFilePath).toBe(
      "src/other.ts",
    );
    expect(useGitHistoryStore.getState().patchLoading).toBe(true);
  });

  it("Branches toggle mounts LogBranchTree and sets log-with-branches layout", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      repoId: "test-repo",
      repoRoot: "/r",
      branches: ["main", "feature", "origin/main"],
      branchFilter: "main",
      authorFilter: "",
      branchTreeOpen: false,
      loading: false,
      commits: [
        {
          sha: "abc",
          shortSha: "abc",
          author: "Jane",
          authorEmail: "j@e.c",
          authorTime: 1_700_000_000,
          subject: "Fix bug",
          parentShas: ["0000001"],
          refs: ["main"],
          changedFiles: [{ path: "src/app.ts", status: "M" }],
        },
      ],
      selectedSha: "abc",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);
    fireEvent.click(screen.getByTestId("git-history-toggle-branches"));
    expect(useGitHistoryStore.getState().branchTreeOpen).toBe(true);
    expect(screen.getByTestId("log-branch-tree")).toBeTruthy();
    expect(screen.getByTestId("git-history-log-body").getAttribute("data-layout")).toBe(
      "log-with-branches",
    );
    expect(screen.getByTestId("git-history-toggle-branches").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("Ctrl+D posts showRevisionDiff to open full diff viewer", () => {
    // GitView behavior this protects: Ctrl+D opens Differences Viewer, not inline preview.
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      repoId: "test-repo",
      repoRoot: "/r",
      branches: ["main"],
      branchFilter: "main",
      loading: false,
      commits: [
        {
          sha: "abc123def456",
          shortSha: "abc123d",
          author: "Jane",
          authorEmail: "j@e.c",
          authorTime: 1_700_000_000,
          subject: "Fix bug",
          changedFiles: [{ path: "src/app.ts", status: "M" }],
        },
      ],
      selectedSha: "abc123def456",
      selectedChangedFilePath: "src/app.ts",
    });
    render(<GitHistoryToolWindow />);
    mergeTestOutbound.length = 0;
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });

    const action = mergeTestOutbound.find(
      (m) => (m as { type: string }).type === "git.menuAction",
    ) as {
      payload: { action: string; commitSha: string; relativePath: string };
    };
    expect(action?.payload.action).toBe("showRevisionDiff");
    expect(action?.payload.commitSha).toBe("abc123def456");
    expect(action?.payload.relativePath).toBe("src/app.ts");
    expect(mergeTestOutbound.some((m) => m.type === "log.fileDiff")).toBe(
      false,
    );
  });

  it("Annotate changed-file click opens revision diff in the active editor group", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      repoId: "test-repo",
      repoRoot: "/r",
      branches: ["main"],
      branchFilter: "main",
      loading: false,
      annotateMode: true,
      showDiffPreview: false,
      commits: [
        {
          sha: "abc123def456",
          shortSha: "abc123d",
          author: "Jane",
          authorEmail: "j@e.c",
          authorTime: 1_700_000_000,
          subject: "Fix bug",
          parentShas: ["0000000000000000000000000000000000000001"],
          changedFiles: [{ path: "README.md", status: "M" }],
        },
      ],
      selectedSha: "abc123def456",
    });
    render(<GitHistoryToolWindow embedded currentSha="abc123def456" />);

    expect(screen.getByTestId("git-history-log-body").dataset.layout).toBe(
      "two-pane",
    );
    expect(screen.queryByTestId("git-diff-preview")).toBeNull();
    expect(
      screen.getByTestId("resizable-split-handle-horizontal"),
    ).toBeTruthy();
    expect(screen.getByTestId("git-log-graph")).toBeTruthy();
    expect(screen.getByText("Jane*")).toBeTruthy();
    expect(screen.getByTestId("git-annotate-commit-footer")).toBeTruthy();
    expect(
      document.querySelector('[data-graph-row="true"][data-current="true"]'),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("changed-files-file-README.md"));

    const action = mergeTestOutbound.find(
      (m) => (m as { type: string }).type === "git.menuAction",
    ) as {
      payload: {
        action: string;
        commitSha: string;
        relativePath: string;
        openInActiveColumn?: boolean;
      };
    };
    expect(action?.payload.action).toBe("showRevisionDiff");
    expect(action?.payload.commitSha).toBe("abc123def456");
    expect(action?.payload.relativePath).toBe("README.md");
    expect(action?.payload.openInActiveColumn).toBe(true);
  });

  it("History commit right-click shows Copy Revision Number", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      repoId: "test-repo",
      repoRoot: "/r",
      branches: ["main"],
      branchFilter: "main",
      loading: false,
      commits: [
        {
          sha: "abc123def456",
          shortSha: "abc123d",
          author: "Jane",
          authorEmail: "j@e.c",
          authorTime: 1_700_000_000,
          subject: "Fix bug",
          changedFiles: [{ path: "src/app.ts", status: "M" }],
        },
      ],
      selectedSha: "abc123def456",
    });
    render(<GitHistoryToolWindow />);
    const commitBtn = screen.getByTestId("git-commit-abc123d");
    fireEvent.contextMenu(commitBtn);
    expect(screen.getByTestId("git-history-commit-context-menu")).toBeTruthy();
    fireEvent.click(screen.getByTestId("git-history-menu-copy-sha"));
    const action = mergeTestOutbound.find(
      (m) => (m as { type: string }).type === "git.menuAction",
    ) as { payload: { action: string; commitSha: string } };
    expect(action?.payload.action).toBe("copyCommitId");
    expect(action?.payload.commitSha).toBe("abc123def456");
  });

  it("ChangesFromBranchPanel shows filter checkbox and branch title", () => {
    useGitPanelStore.setState({
      changesFromSide: {
        open: true,
        side: "ours",
        relativePath: "src/app.ts",
        branchLabel: "feature/login",
        filterByFile: true,
        loading: false,
        error: null,
        mergeBase: "base",
        revisionRange: "base..HEAD",
        branchRef: "HEAD",
        commits: [],
        allChangedPaths: [],
        selectedSha: null,
        previewText: "const ours = true;",
      },
    });
    render(<ChangesFromBranchPanel />);
    expect(
      screen.getByRole("dialog", { name: "Changes from feature/login" }),
    ).toBeTruthy();
    expect(screen.getByText("Filter by conflicted file")).toBeTruthy();
    expect(screen.getByTestId("git-panel-dialog")).toBeTruthy();
    expect(screen.getByTestId("changes-from-body")).toBeTruthy();
    expect(
      document
        .querySelector('[data-testid="git-commit-detail"] code[data-language]')
        ?.getAttribute("data-language"),
    ).toBe("typescript");
  });
});