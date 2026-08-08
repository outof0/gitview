// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { ConflictListScreen } from "../ConflictListScreen";
import { useGitViewStore } from "../../stores/gitViewStore";
import { setupMergeTestBootstrap } from "../../test/mergeTestProviders";
import {
  findMergeTestMessage,
  mergeTestOutbound,
} from "../../hooks/merge/mergeClientContext";

beforeEach(() => {
  setupMergeTestBootstrap("test-repo");
  useGitViewStore.setState({
    screen: "conflictList",
    conflictFiles: [],
    branchInfo: null,
    loading: false,
    error: null,
  });
});

afterEach(() => cleanup());

describe("ConflictListScreen", () => {
  it("shows the empty state when there are no conflicts", () => {
    render(<ConflictListScreen />);
    expect(screen.getByText(/No unresolved Git conflicts/i)).toBeTruthy();
  });

  it("lists conflict files from the store", () => {
    useGitViewStore.setState({
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "AA" },
      ],
    });
    render(<ConflictListScreen />);
    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.getByText("src/b.ts")).toBeTruthy();
    expect(screen.getByText(/2 files need resolution/i)).toBeTruthy();
  });

  it("clicking a file dispatches merge:openFile with its path", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
      error: "old error",
    });
    render(<ConflictListScreen />);

    fireEvent.click(screen.getByText("src/a.ts"));

    const open = findMergeTestMessage("merge.openFile");
    expect(open).toBeDefined();
    expect((open!.payload as { path: string }).path).toBe("src/a.ts");
    expect(useGitViewStore.getState().screen).toBe("conflictList");
    expect(useGitViewStore.getState().loading).toBe(true);
    expect(useGitViewStore.getState().error).toBeNull();
  });

  it("Refresh dispatches conflicts:refresh", () => {
    render(<ConflictListScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mergeTestOutbound.some((m) => m.type === "conflict.refresh")).toBe(
      true,
    );
  });

  it("renders an error message from the store", () => {
    useGitViewStore.setState({ error: "boom: no repo" });
    render(<ConflictListScreen />);
    expect(screen.getByText(/boom: no repo/)).toBeTruthy();
  });

  it("shows loading state while conflicts are being fetched", () => {
    useGitViewStore.setState({ loading: true, conflictFiles: [] });
    render(<ConflictListScreen />);
    expect(screen.getByText(/Loading conflicts/i)).toBeTruthy();
  });

  it("updates the file list when the store receives new conflicts", () => {
    const { rerender } = render(<ConflictListScreen />);
    expect(screen.getByText(/No unresolved Git conflicts/i)).toBeTruthy();

    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/new.ts", stageCode: "UU" }],
      loading: false,
    });
    rerender(<ConflictListScreen />);
    expect(screen.getByText("src/new.ts")).toBeTruthy();
    expect(screen.getByText(/1 file need resolution/i)).toBeTruthy();
  });

  it("the per-row Resolve button also opens the file", () => {
    useGitViewStore.setState({
      conflictFiles: [{ relativePath: "src/a.ts", stageCode: "UU" }],
    });
    render(<ConflictListScreen />);
    const row = screen.getByText("src/a.ts").closest("div")!;
    fireEvent.click(
      within(row.parentElement as HTMLElement).getByRole("button", {
        name: "Resolve",
      }),
    );
    expect(
      mergeTestOutbound.filter((m) => m.type === "merge.openFile").length,
    ).toBeGreaterThan(0);
  });
});
