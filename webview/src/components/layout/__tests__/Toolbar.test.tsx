// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Toolbar } from "../Toolbar";
import { useGitViewStore } from "../../../stores/gitViewStore";

beforeEach(() => {
  useGitViewStore.setState({
    whitespacePolicy: "doNotIgnore",
    highlightingMode: "words",
    showBase: false,
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

  it("hides resolve-simple when no both_same unresolved", () => {
    renderToolbar({ unresolvedSimpleConflicts: 0 });
    expect(screen.queryByLabelText("Resolve simple conflicts")).toBeNull();
  });

  it("opens the Whitespace dropdown and selects a policy", () => {
    renderToolbar();
    fireEvent.click(screen.getByTitle("Whitespace policy"));
    fireEvent.click(screen.getByText("Ignore whitespaces"));
    expect(useGitViewStore.getState().whitespacePolicy).toBe("ignoreWhitespaces");
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
