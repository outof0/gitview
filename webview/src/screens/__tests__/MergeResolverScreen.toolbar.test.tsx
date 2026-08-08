// @vitest-environment jsdom
import "./mergeResolverScreen.testSetup";
import { describe, it, expect } from "vitest";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { MergeResolverScreen } from "../MergeResolverScreen";
import { useGitViewStore } from "../../stores/gitViewStore";
import { loadDoc, posted } from "./mergeResolverScreen.testSetup";

describe("MergeResolverScreen", () => {
  it("renders an overview ruler with one tick per navigable block", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    const navigable = doc.blocks.filter((b) => b.kind !== "unchanged").length;
    expect(screen.getAllByTestId("overview-ruler-tick").length).toBe(navigable);
  });

  it("does not render the base pane by default", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    expect(screen.queryByTestId("pane-base-wrap")).toBeNull();
  });

  it("renders the base pane when showBase is enabled", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ showBase: true });
    render(<MergeResolverScreen />);
    expect(screen.getByTestId("pane-base-wrap")).toBeTruthy();
    expect(screen.getByText("Base Revision")).toBeTruthy();
  });

  it("renders syntax-highlighted keyword spans in code panes", () => {
    loadDoc("const a = 1\n", "const a = 2\n", "const a = 3\n");
    const { container } = render(<MergeResolverScreen />);
    expect(
      container.querySelectorAll(".syntax-keyword").length,
    ).toBeGreaterThan(0);
  });

  it("highlighting mode propagates to side pane editors", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ highlightingMode: "words" });
    const { container, rerender } = render(<MergeResolverScreen />);
    expect(
      container.querySelector(
        '[data-testid="pane-left"][data-highlighting="words"]',
      ),
    ).toBeTruthy();

    useGitViewStore.getState().setHighlightingMode("none");
    rerender(<MergeResolverScreen />);
    expect(
      container.querySelector(
        '[data-testid="pane-left"][data-highlighting="none"]',
      ),
    ).toBeTruthy();
  });

  it("showBase renders the base revision pane", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ showBase: true });
    render(<MergeResolverScreen />);
    expect(screen.getByTestId("pane-base-wrap")).toBeTruthy();
    expect(screen.getByText("Base Revision")).toBeTruthy();
  });

  it("compare mode is exposed on the pane grid wrapper", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({ compareMode: "localRepo" });
    const { container } = render(<MergeResolverScreen />);
    expect(
      container.querySelector('[data-compare-mode="localRepo"]'),
    ).toBeTruthy();
  });

  it("toolbar prev/next buttons change the active block", () => {
    const doc = loadDoc("a\nb\nc\nd", "A\nb\nc\nd", "a\nb\nc\nD");
    const navigable = doc.changeOrder;
    expect(navigable.length).toBeGreaterThan(1);
    useGitViewStore.setState({ activeBlockId: navigable[0] });
    render(<MergeResolverScreen />);

    fireEvent.click(screen.getByTitle("Next difference (F7)"));
    expect(useGitViewStore.getState().activeBlockId).toBe(navigable[1]);

    fireEvent.click(screen.getByTitle("Previous difference (Shift+F7)"));
    expect(useGitViewStore.getState().activeBlockId).toBe(navigable[0]);
  });

  it("toolbar next wraps without prompting to discard dirty edits", () => {
    const doc = loadDoc(
      "a\nb\nc\nd",
      "A\nb\nc\nd",
      "a\nb\nc\nD",
    );
    const navigable = doc.changeOrder;
    useGitViewStore.setState({
      activeDocument: { ...doc, dirty: true },
      activeBlockId: navigable[navigable.length - 1],
      goToNextFileAfterLastChange: true,
      conflictFiles: [
        { relativePath: "src/app.ts", stageCode: "UU" },
        { relativePath: "src/other.ts", stageCode: "UU" },
      ],
    });
    render(<MergeResolverScreen />);

    fireEvent.click(screen.getByTitle("Next difference (F7)"));

    expect(posted).toEqual([]);
    expect(useGitViewStore.getState().activeBlockId).toBe(navigable[0]);
  });
});
