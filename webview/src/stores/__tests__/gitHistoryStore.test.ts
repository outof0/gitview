import { describe, it, expect, beforeEach } from "vitest";
import { useGitHistoryStore } from "../gitHistoryStore";

describe("gitHistoryStore stale-result guards", () => {
  beforeEach(() => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      repoRoot: "/repo",
      branches: ["main"],
      branchFilter: "main",
      loading: true,
      commits: [],
      selectedSha: "oldsha1234567890abcdef1234567890abcdef12",
      selectedChangedFilePath: "src/app.ts",
      fileDiff: null,
      patchLoading: true,
      patchError: null,
      error: null,
    });
  });

  it("ignores git:logResult for a different path", () => {
    useGitHistoryStore.getState().setLogResult({
      path: "other/file.ts",
      branch: "main",
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Stale",
          changedFiles: [],
        },
      ],
    });

    expect(useGitHistoryStore.getState().commits).toEqual([]);
    expect(useGitHistoryStore.getState().loading).toBe(true);
  });

  it("ignores git:logResult for a different branch filter", () => {
    useGitHistoryStore.getState().setLogResult({
      path: "src/app.ts",
      branch: "feature",
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Stale branch",
          changedFiles: [],
        },
      ],
    });

    expect(useGitHistoryStore.getState().commits).toEqual([]);
    expect(useGitHistoryStore.getState().loading).toBe(true);
  });

  it("accepts log results when branchFilter is empty (annotate / unfiltered)", () => {
    useGitHistoryStore.setState({
      branchFilter: "",
      loading: true,
      commits: [],
    });

    useGitHistoryStore.getState().setLogResult({
      path: "src/app.ts",
      branch: "master",
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Annotate log",
          changedFiles: [],
        },
      ],
    });

    expect(useGitHistoryStore.getState().loading).toBe(false);
    expect(useGitHistoryStore.getState().commits).toHaveLength(1);
    expect(useGitHistoryStore.getState().commits[0]?.subject).toBe("Annotate log");
  });

  it("ignores file patch results for a different selected file", () => {
    useGitHistoryStore.getState().setFileDiffResult({
      sha: useGitHistoryStore.getState().selectedSha ?? "",
      path: "other/file.ts",
      diff: {
        layout: "split",
        status: "M",
        left: { label: "old", text: "a" },
        right: { label: "new", text: "b" },
      },
    });

    expect(useGitHistoryStore.getState().fileDiff).toBeNull();
    expect(useGitHistoryStore.getState().patchLoading).toBe(true);
  });

  it("selectCommit picks a default changed file for diff preview", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      showDiffPreview: true,
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Fix",
          changedFiles: [
            { path: "src/app.ts", status: "M" },
            { path: "src/other.ts", status: "M" },
          ],
        },
      ],
      selectedSha: null,
      selectedChangedFilePath: null,
    });

    useGitHistoryStore
      .getState()
      .selectCommit("abc1234567890abcdef1234567890abcdef12345");

    const state = useGitHistoryStore.getState();
    expect(state.selectedSha).toBe(
      "abc1234567890abcdef1234567890abcdef12345",
    );
    expect(state.selectedChangedFilePath).toBe("src/app.ts");
    expect(state.patchLoading).toBe(true);
  });

  it("annotateMode hides file-scoped log files until commit detail loads", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      annotateMode: true,
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Fix",
          changedFiles: [{ path: "src/app.ts", status: "M" }],
        },
      ],
    });

    useGitHistoryStore
      .getState()
      .selectCommit("abc1234567890abcdef1234567890abcdef12345");

    expect(useGitHistoryStore.getState().commitDetailLoading).toBe(true);
    expect(useGitHistoryStore.getState().changedFilesForSelection()).toEqual([]);
  });

  it("annotateMode shows all changed files from commit detail", () => {
    useGitHistoryStore.setState({
      path: "src/app.ts",
      isFolder: false,
      annotateMode: true,
      showDiffPreview: false,
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Fix",
          changedFiles: [{ path: "src/app.ts", status: "M" }],
        },
      ],
    });

    useGitHistoryStore.getState().applyCommitDetail({
      sha: "abc1234567890abcdef1234567890abcdef12345",
      shortSha: "abc1234",
      author: "A",
      authorEmail: "a@example.com",
      authorTime: 1,
      subject: "Fix",
      changedFiles: [
        { path: "src/app.ts", status: "M" },
        { path: "packages/other.ts", status: "M" },
        { path: "README.md", status: "M" },
      ],
    });

    const files = useGitHistoryStore.getState().changedFilesForSelection();
    expect(files).toHaveLength(3);
    expect(files.map((f) => f.path)).toEqual([
      "src/app.ts",
      "packages/other.ts",
      "README.md",
    ]);
  });

  it("filteredCommits matches search query on subject and author", () => {
    useGitHistoryStore.setState({
      searchQuery: "login",
      commits: [
        {
          sha: "1111111111111111111111111111111111111111",
          shortSha: "1111111",
          author: "Alice",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Add login form",
          changedFiles: [],
        },
        {
          sha: "2222222222222222222222222222222222222222",
          shortSha: "2222222",
          author: "Bob",
          authorEmail: "b@example.com",
          authorTime: 2,
          subject: "Fix typo",
          changedFiles: [],
        },
      ],
    });

    const filtered = useGitHistoryStore.getState().filteredCommits();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.subject).toBe("Add login form");
  });

  it("branchTreeOpen defaults false and init resets closed", () => {
    expect(useGitHistoryStore.getState().branchTreeOpen).toBe(false);

    useGitHistoryStore.getState().setBranchTreeOpen(true);
    expect(useGitHistoryStore.getState().branchTreeOpen).toBe(true);

    useGitHistoryStore.getState().init({
      path: "src/app.ts",
      isFolder: false,
      repoId: "repo-1",
      branches: ["main", "feature"],
      currentBranch: "main",
    });
    expect(useGitHistoryStore.getState().branchTreeOpen).toBe(false);
  });

  it("init enables showDiffPreview so selecting a changed file loads a diff", () => {
    useGitHistoryStore.setState({ showDiffPreview: false });
    useGitHistoryStore.getState().init({
      path: "src/app.ts",
      isFolder: false,
      repoId: "repo-1",
      branches: ["main"],
      currentBranch: "main",
    });
    expect(useGitHistoryStore.getState().showDiffPreview).toBe(true);

    useGitHistoryStore.setState({
      annotateMode: false,
      showDiffPreview: true,
      selectedSha: "abc1234567890abcdef1234567890abcdef12345",
      commits: [
        {
          sha: "abc1234567890abcdef1234567890abcdef12345",
          shortSha: "abc1234",
          author: "A",
          authorEmail: "a@example.com",
          authorTime: 1,
          subject: "Fix",
          changedFiles: [
            { path: "src/app.ts", status: "M" },
            { path: "src/other.ts", status: "M" },
          ],
        },
      ],
    });

    useGitHistoryStore.getState().selectChangedFile("src/other.ts");
    const state = useGitHistoryStore.getState();
    expect(state.selectedChangedFilePath).toBe("src/other.ts");
    expect(state.patchLoading).toBe(true);
  });
});