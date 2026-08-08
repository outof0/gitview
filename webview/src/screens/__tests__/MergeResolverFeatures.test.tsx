// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { MergeResolverScreen } from "../MergeResolverScreen";
import { ToastContainer } from "../../components/ui/ToastContainer";
import { ChangesFromBranchPanel } from "../../components/git/ChangesFromBranchPanel";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useGitPanelStore } from "../../stores/gitPanelStore";
import { useBlameStore } from "../../stores/blameStore";
import { buildMergeDocument } from "../../../../src/core/mergeDocument";
import type { MergeDocument } from "../../../../src/core/types";

beforeEach(() => {
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: () => {},
    getState: () => null,
    setState: () => {},
  });
  // Reset transient UI state between tests.
  useGitViewStore.setState({
    activeDocument: null,
    activeBlockId: null,
    screen: "mergeResolver",
    showBase: false,
    showDetails: false,
    showConflictsNavigation: false,
    searchOpen: false,
    searchQuery: "",
    searchActiveIndex: 0,
  });
  useGitPanelStore.getState().closeGitHistory();
  useGitPanelStore.getState().closeChangesFromSide();
  useBlameStore.getState().reset();
  // jsdom has no scrollIntoView.
  (
    Element.prototype as unknown as { scrollIntoView: () => void }
  ).scrollIntoView = () => {};
});

function renderMergeWithPanels() {
  return render(
    <>
      <MergeResolverScreen />
      <ChangesFromBranchPanel />
    </>,
  );
}

afterEach(() => cleanup());

function loadDoc(base: string, ours: string, theirs: string): MergeDocument {
  const doc = buildMergeDocument({
    repoRoot: "/r",
    relativePath: "src/app.ts",
    absolutePath: "/r/src/app.ts",
    base,
    ours,
    theirs,
    worktree: ours,
  });
  useGitViewStore.setState({ activeDocument: doc });
  return doc;
}

function loadLongContextDoc(): MergeDocument {
  const ctx = "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\n";
  return loadDoc(`${ctx}mid\n`, `${ctx}ours\n`, `${ctx}theirs\n`);
}

describe("MergeResolverScreen — Show Details and blame details", () => {
  it("does not render blame cells when annotate is off", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const { container } = render(<MergeResolverScreen />);
    expect(container.querySelectorAll(".nx-blame").length).toBe(0);
  });

  it("shows loading blame placeholder while blame is in flight", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const view = render(<MergeResolverScreen />);
    fireEvent.contextMenu(screen.getByTestId("pane-left-wrap"));
    fireEvent.click(view.getByTestId("git-menu-annotate"));
    useBlameStore.getState().setLoading("ours", "src/app.ts");
    view.rerender(<MergeResolverScreen />);
    expect(view.container.textContent).toContain("Loading blame");
  });

  it("shows blame error toast when annotate fails", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const view = render(
      <>
        <MergeResolverScreen />
        <ToastContainer />
      </>,
    );
    fireEvent.contextMenu(screen.getByTestId("pane-left-wrap"));
    fireEvent.click(view.getByTestId("git-menu-annotate"));
    useBlameStore.getState().setLoading("ours", "src/app.ts");
    useBlameStore.getState().setResult({
      relativePath: "src/app.ts",
      side: "ours",
      error: { message: "binary file" },
    });
    view.rerender(
      <>
        <MergeResolverScreen />
        <ToastContainer />
      </>,
    );
    expect(view.getByText("binary file")).toBeTruthy();
  });

  it("shows real git blame in the column after Annotate with Git Blame", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const view = render(<MergeResolverScreen />);
    fireEvent.contextMenu(screen.getByTestId("pane-left-wrap"));
    fireEvent.click(view.getByTestId("git-menu-annotate"));
    useBlameStore.getState().setResult({
      relativePath: "src/app.ts",
      side: "ours",
      lines: [
        {
          lineNumber: 2,
          sha: "abc1234567890abcdef1234567890abcdef1234",
          shortSha: "abc1234",
          author: "Jane Doe",
          authorEmail: "j@example.com",
          authorTime: 1_700_000_000,
          summary: "Fix",
        },
      ],
    });
    view.rerender(<MergeResolverScreen />);
    expect(view.container.querySelectorAll(".nx-blame").length).toBeGreaterThan(
      0,
    );
    expect(view.container.textContent).toContain("Jane Doe");
    expect(view.container.textContent).toContain("abc1234");
  });

  it("opens changes-from-branch panel from the side pane Show Details link", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    renderMergeWithPanels();
    fireEvent.click(screen.getAllByText("Show Details")[0]!);
    expect(
      screen.getByRole("dialog", { name: `Changes from ${doc.oursLabel}` }),
    ).toBeTruthy();
    expect(screen.getByText("Filter by conflicted file")).toBeTruthy();
    expect(screen.getByTestId("changes-from-branch-panel")).toBeTruthy();
  });
});

describe("MergeResolverScreen — unchanged context", () => {
  it("renders long unchanged runs directly without layout gaps", () => {
    loadLongContextDoc();
    useGitViewStore.setState({ foldUnchangedRegions: false });
    render(<MergeResolverScreen />);
    expect(screen.queryByLabelText("expand-collapsed")).toBeNull();
    const left = screen.getByTestId("pane-left");
    expect(within(left).getAllByText("l1").length).toBeGreaterThan(0);
    expect(within(left).getAllByText("l8").length).toBeGreaterThan(0);
  });
});

describe("MergeResolverScreen — search & replace", () => {
  it("opens the search panel and counts matches in the center", () => {
    loadDoc("a\nfindme\nc\n", "a\nfindme\nc\n", "a\nfindme\nc\n");
    useGitViewStore.setState({ searchOpen: true });
    render(<MergeResolverScreen />);
    fireEvent.change(screen.getByLabelText("find"), {
      target: { value: "findme" },
    });
    const count = screen.getByTestId("search-count");
    // At least one matching row in the result pane.
    expect(count.textContent).toMatch(/\/[1-9]/);
    expect(document.querySelectorAll(".nx-match").length).toBeGreaterThan(0);
  });

  it("shows 0/0 for a query with no matches", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ searchOpen: true });
    render(<MergeResolverScreen />);
    fireEvent.change(screen.getByLabelText("find"), {
      target: { value: "zzzzz" },
    });
    expect(screen.getByTestId("search-count").textContent).toBe("0/0");
  });

  it("Replace All rewrites matching text in the editable result", () => {
    // Resolve the conflict first so the center block becomes editable.
    loadDoc("a\nb\nc\n", "a\nfoo\nc\n", "a\nfoo\nc\n");
    useGitViewStore.setState({ searchOpen: true });
    render(<MergeResolverScreen />);
    fireEvent.change(screen.getByLabelText("find"), {
      target: { value: "foo" },
    });
    fireEvent.change(screen.getByLabelText("replace-input"), {
      target: { value: "bar" },
    });
    fireEvent.click(screen.getByLabelText("replace-all"));
    const result = useGitViewStore.getState().getResultText();
    expect(result).toContain("bar");
    expect(result).not.toContain("foo");
  });
});

// GitView workflow coverage: conflicts navigation lists changes and jumps to selection.
describe("MergeResolverScreen — conflicts navigation sidebar", () => {
  it("is hidden when showConflictsNavigation is false", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ showConflictsNavigation: false });
    render(<MergeResolverScreen />);
    expect(screen.queryByTestId("conflicts-nav")).toBeNull();
  });

  it("lists navigable changes and marks the active conflict unresolved", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const conflictId = doc.blocks.find((b) => b.kind === "conflict")!.id;
    useGitViewStore.setState({
      showConflictsNavigation: true,
      activeBlockId: conflictId,
    });
    render(<MergeResolverScreen />);

    expect(screen.getByTestId("conflicts-nav")).toBeTruthy();
    expect(screen.getByText(/Conflicts Navigation/)).toBeTruthy();
    expect(screen.getByLabelText(`jump-${conflictId}`)).toBeTruthy();
    expect(screen.getByText("unresolved")).toBeTruthy();
  });

  it("jump button selects the target block", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const conflictId = doc.blocks.find((b) => b.kind === "conflict")!.id;
    useGitViewStore.setState({ showConflictsNavigation: true });
    render(<MergeResolverScreen />);

    fireEvent.click(screen.getByLabelText(`jump-${conflictId}`));
    expect(useGitViewStore.getState().activeBlockId).toBe(conflictId);
  });

  it("shows resolved status after both sides are handled", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ showConflictsNavigation: true });
    render(<MergeResolverScreen />);

    fireEvent.click(
      within(screen.getByTestId("pane-left")).getByLabelText("accept-left"),
    );
    fireEvent.click(
      within(screen.getByTestId("pane-right")).getByLabelText("ignore"),
    );

    expect(screen.getByText("resolved")).toBeTruthy();
    expect(screen.queryByText("unresolved")).toBeNull();
  });
});
