// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { buildMergeDocument } from "../../../../../src/core/mergeDocument";
import { Toolbar } from "../Toolbar";
import { useGitViewStore } from "../../../stores/gitViewStore";

beforeEach(() => {
  useGitViewStore.setState({
    whitespacePolicy: "doNotIgnore",
    highlightingMode: "words",
    showBase: false,
    activeDocument: null,
    undoStack: [],
    redoStack: [],
    statusMessage: null,
  });
});

afterEach(() => cleanup());

function renderToolbar(props?: Partial<Parameters<typeof Toolbar>[0]>) {
  return render(
    <Toolbar
      remainingConflicts={1}
      totalChanges={3}
      unresolvedNonConflicting={2}
      unresolvedSimpleConflicts={1}
      onPrev={() => {}}
      onNext={() => {}}
      {...props}
    />,
  );
}

function buildMagicMergeDocument() {
  return buildMergeDocument({
    repoRoot: "/r",
    relativePath: "magic.txt",
    absolutePath: "/r/magic.txt",
    base: "This is a simple conflict that can be resolved.\n",
    ours: "Below is a simple conflict that can be resolved.\n",
    theirs: "This is a simple conflict that can be resolved automatically.\n",
    worktree: "Below is a simple conflict that can be resolved.\n",
  });
}

describe("Toolbar", () => {
  it("renders the change/conflict counter", () => {
    renderToolbar({ remainingConflicts: 1, totalChanges: 3 });
    expect(screen.getByText(/3 changes\./)).toBeTruthy();
    expect(screen.getByText(/1 conflict\./)).toBeTruthy();
  });

  it("renders prev/next and the three apply-non-conflicting buttons", () => {
    renderToolbar();
    expect(screen.getByLabelText("Previous difference")).toBeTruthy();
    expect(screen.getByLabelText("Next difference")).toBeTruthy();
    expect(
      screen.getByLabelText("Apply non-conflicting from left"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Apply all non-conflicting")).toBeTruthy();
    expect(
      screen.getByLabelText("Apply non-conflicting from right"),
    ).toBeTruthy();
  });

  it("hides nav arrows when only 1 change", () => {
    renderToolbar({
      totalChanges: 1,
      unresolvedNonConflicting: 0,
      unresolvedSimpleConflicts: 0,
    });
    expect(screen.queryByLabelText("Previous difference")).toBeNull();
    expect(screen.queryByLabelText("Next difference")).toBeNull();
  });

  it("hides apply-non-conflicting when none unresolved", () => {
    renderToolbar({ unresolvedNonConflicting: 0 });
    expect(
      screen.queryByLabelText("Apply non-conflicting from left"),
    ).toBeNull();
    expect(screen.queryByLabelText("Apply all non-conflicting")).toBeNull();
    expect(
      screen.queryByLabelText("Apply non-conflicting from right"),
    ).toBeNull();
  });

  it("hides Magic Merge when no simple conflict is resolvable", () => {
    renderToolbar({ unresolvedSimpleConflicts: 0 });
    expect(
      screen.queryByLabelText("Magic Merge: Resolve simple conflicts"),
    ).toBeNull();
  });

  it("labels Magic Merge clearly and resolves a simple conflict", () => {
    const doc = buildMagicMergeDocument();
    useGitViewStore.setState({ activeDocument: doc });
    renderToolbar({
      remainingConflicts: 1,
      totalChanges: 1,
      unresolvedNonConflicting: 0,
      unresolvedSimpleConflicts: 1,
    });

    const button = screen.getByRole("button", {
      name: "Magic Merge: Resolve simple conflicts",
    });
    expect(button.getAttribute("title")).toBe(
      "Magic Merge — Resolve simple conflicts",
    );
    fireEvent.click(button);

    const conflict = useGitViewStore
      .getState()
      .activeDocument?.blocks.find((block) => block.kind === "conflict");
    expect(conflict?.resultText).toBe(
      "Below is a simple conflict that can be resolved automatically.",
    );
  });

  it("opens the Whitespace dropdown and selects a policy", () => {
    renderToolbar();
    fireEvent.click(screen.getByTitle("Whitespace policy"));
    fireEvent.click(screen.getByText("Ignore whitespaces"));
    expect(useGitViewStore.getState().whitespacePolicy).toBe(
      "ignoreWhitespaces",
    );
  });

  it("opens the Highlighting dropdown and selects a mode", () => {
    renderToolbar();
    fireEvent.click(screen.getByTitle("Highlighting policy"));
    fireEvent.click(screen.getByText("Do not highlight"));
    expect(useGitViewStore.getState().highlightingMode).toBe("none");
  });

  it("View dropdown toggles Show Base Revision in the store", () => {
    renderToolbar();
    expect(useGitViewStore.getState().showBase).toBe(false);
    fireEvent.click(screen.getByTitle("View options"));
    fireEvent.click(screen.getByText("Show Base Revision"));
    expect(useGitViewStore.getState().showBase).toBe(true);
  });

  it("View dropdown sets compare mode and enables base for local/base compare", () => {
    renderToolbar();
    fireEvent.click(screen.getByTitle("View options"));
    fireEvent.click(screen.getByText("Compare Local with Base"));
    expect(useGitViewStore.getState().compareMode).toBe("localBase");
    expect(useGitViewStore.getState().showBase).toBe(true);
  });

  it("View dropdown sets local vs repository compare mode", () => {
    renderToolbar();
    fireEvent.click(screen.getByTitle("View options"));
    fireEvent.click(screen.getByText("Compare Local with Repository"));
    expect(useGitViewStore.getState().compareMode).toBe("localRepo");
  });

  it("closes a dropdown after selection", () => {
    renderToolbar();
    fireEvent.click(screen.getByTitle("Highlighting policy"));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByText("Highlight lines"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("invokes onPrev and onNext when navigation buttons are clicked", () => {
    let prevCount = 0;
    let nextCount = 0;
    renderToolbar({
      onPrev: () => {
        prevCount += 1;
      },
      onNext: () => {
        nextCount += 1;
      },
    });

    fireEvent.click(screen.getByLabelText("Previous difference"));
    fireEvent.click(screen.getByLabelText("Next difference"));

    expect(prevCount).toBe(1);
    expect(nextCount).toBe(1);
  });
});
