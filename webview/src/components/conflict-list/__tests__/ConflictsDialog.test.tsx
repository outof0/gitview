// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, cleanup, within } from "@testing-library/react";
import { ConflictsDialog } from "../ConflictsDialog";
import { useGitViewStore } from "../../../stores/gitViewStore";
import {
  renderWithMerge,
  setupMergeTestBootstrap,
} from "../../../test/mergeTestProviders";
import { findMergeTestMessage } from "../../../hooks/merge/mergeClientContext";

beforeEach(() => {
  setupMergeTestBootstrap("test-repo");
  useGitViewStore.setState({
    screen: "conflictList",
    conflictFiles: [],
    branchInfo: { currentBranch: "master", mergeHead: "branch-ours" },
    loading: false,
    error: null,
  });
});

afterEach(() => cleanup());

describe("ConflictsDialog", () => {
  it("shows the empty state when there are no conflicts", () => {
    useGitViewStore.setState({ conflictFiles: [] });
    renderWithMerge(<ConflictsDialog />);
    expect(screen.getByText(/No conflicts remaining/i)).toBeTruthy();
  });

  it("lists conflict files in a flat table by default", () => {
    useGitViewStore.setState({
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "AA" },
        { relativePath: "package.json", stageCode: "UU" },
      ],
    });
    renderWithMerge(<ConflictsDialog />);

    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.getByText("src/b.ts")).toBeTruthy();
    expect(screen.getByText("package.json")).toBeTruthy();
    expect(screen.queryByText("src")).toBeNull();
    expect(screen.queryByText(/3 conflicts remaining/i)).toBeNull();
  });

  it("supports collapsing/expanding directory groupings", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    renderWithMerge(<ConflictsDialog />);
    fireEvent.click(screen.getByLabelText("Group files by directory"));

    expect(screen.queryByText("a.ts")).toBeTruthy();

    // Click chevron to collapse
    fireEvent.click(screen.getByLabelText("Toggle folder src"));
    expect(screen.queryByText("a.ts")).toBeNull();

    // Click chevron to expand again
    fireEvent.click(screen.getByLabelText("Toggle folder src"));
    expect(screen.queryByText("a.ts")).toBeTruthy();
  });

  it("clicking a file selects it, and double clicking a file dispatches merge:openFile", () => {
    useGitViewStore.setState({
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "UU" },
      ],
    });
    renderWithMerge(<ConflictsDialog />);

    // Click second file to select
    const fileB = screen.getByText("src/b.ts");
    fireEvent.click(fileB);

    // Double click to merge
    fireEvent.doubleClick(fileB);

    const open = findMergeTestMessage("merge.openFile");
    expect(open).toBeDefined();
    expect((open!.payload as { path: string }).path).toBe("src/b.ts");
  });

  it("Accept Yours dispatches conflicts:acceptYours for the selected file", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    renderWithMerge(<ConflictsDialog />);

    // Select file and click Accept Yours
    fireEvent.click(screen.getByText("src/a.ts"));
    fireEvent.click(screen.getByRole("button", { name: /Accept Yours$/ }));

    const action = findMergeTestMessage("conflict.acceptLocal");
    expect(action).toBeDefined();
    expect((action!.payload as { paths: string[] }).paths).toEqual(["src/a.ts"]);
  });

  it("Accept Theirs dispatches conflicts:acceptTheirs for the selected file", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    renderWithMerge(<ConflictsDialog />);

    // Select file and click Accept Theirs
    fireEvent.click(screen.getByText("src/a.ts"));
    fireEvent.click(screen.getByRole("button", { name: /Accept Theirs$/ }));

    const action = findMergeTestMessage("conflict.acceptIncoming");
    expect(action).toBeDefined();
    expect((action!.payload as { paths: string[] }).paths).toEqual(["src/a.ts"]);
  });

  it("exposes per-file accept and merge actions matching GitView conflicts dialog", () => {
    useGitViewStore.setState({
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "UU" },
      ],
    });
    renderWithMerge(<ConflictsDialog />);

    expect(screen.getByRole("button", { name: "Accept Yours" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept Theirs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Merge..." })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Git History" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Apply Non-Conflicting" }),
    ).toBeNull();
  });

  it("right-click on a file shows Show Git History in the context menu", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    renderWithMerge(<ConflictsDialog />);

    fireEvent.contextMenu(screen.getByText("src/a.ts"));
    expect(screen.getByTestId("conflicts-context-menu")).toBeTruthy();
    expect(screen.getByTestId("git-menu-show-history")).toBeTruthy();
    expect(screen.getByText("Show History")).toBeTruthy();
  });

  it("right-click on a folder dispatches gitHistory:open for the folder", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    renderWithMerge(<ConflictsDialog />);
    fireEvent.click(screen.getByLabelText("Group files by directory"));

    fireEvent.contextMenu(screen.getByText("src"));
    fireEvent.click(screen.getByTestId("git-menu-show-history"));

    const open = findMergeTestMessage("history.openPanel");
    expect(open).toBeDefined();
    expect((open!.payload as { path: string; isFolder: boolean }).path).toBe(
      "src",
    );
    expect((open!.payload as { isFolder: boolean }).isFolder).toBe(true);
  });

  it("Group files by directory checkbox toggles directory grouping", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    renderWithMerge(<ConflictsDialog />);

    // By default, flat list shows the full relative path.
    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.queryByText("src")).toBeNull();

    // Toggle checkbox
    fireEvent.click(screen.getByLabelText("Group files by directory"));

    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("a.ts")).toBeTruthy();
  });

  it("context menu Merge uses the right-clicked file, not the prior selection", () => {
    useGitViewStore.setState({
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "UU" },
      ],
    });
    renderWithMerge(<ConflictsDialog />);

    fireEvent.contextMenu(screen.getByTestId("conflicts-file-row-src/b.ts"));
    fireEvent.click(
      within(screen.getByTestId("conflicts-context-menu")).getByText("Merge..."),
    );

    const open = findMergeTestMessage("merge.openFile");
    expect(open).toBeDefined();
    expect((open!.payload as { path: string }).path).toBe("src/b.ts");
  });
});
