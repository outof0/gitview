// @vitest-environment jsdom
import "./mergeResolverScreen.testSetup";
import { describe, it, expect } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { MergeResolverScreen } from "../MergeResolverScreen";
import { useGitViewStore } from "../../stores/gitViewStore";
import { findMergeTestMessage } from "../../hooks/merge/mergeClientContext";
import { loadDoc, posted } from "./mergeResolverScreen.testSetup";

describe("MergeResolverScreen", () => {
  it("center conflict context menu includes resolve actions", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const { container } = render(<MergeResolverScreen />);

    const conflictText = within(screen.getByTestId("pane-center")).getByText(
      "b",
    );
    fireEvent.contextMenu(conflictText);

    expect(screen.getByTestId("merge-context-menu")).toBeTruthy();
    expect(screen.getByTestId("merge-context-accept-local")).toBeTruthy();
    expect(screen.getByTestId("merge-context-resolve-local")).toBeTruthy();
    expect(screen.getByTestId("merge-context-reset")).toBeTruthy();
    expect(screen.getByTestId("git-menu-show-history")).toBeTruthy();
    expect(container.querySelector('[data-testid="pane-left"]')).toBeTruthy();
  });

  it("unchanged block context menu does not show resolve actions", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const unchanged = within(screen.getByTestId("pane-left")).getAllByText(
      "a",
    )[0]!;
    fireEvent.contextMenu(unchanged);

    expect(screen.getByTestId("git-menu-show-history")).toBeTruthy();
    expect(screen.queryByTestId("merge-context-accept-local")).toBeNull();
    expect(screen.queryByTestId("merge-context-resolve-local")).toBeNull();
  });

  it("side conflict context menu shows resolve actions on the conflict block", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.contextMenu(
      within(screen.getByTestId("pane-left")).getByText("ours"),
    );

    expect(screen.getByTestId("git-menu-show-history")).toBeTruthy();
    expect(screen.getByTestId("merge-context-accept-local")).toBeTruthy();
    expect(screen.getByTestId("merge-context-resolve-local")).toBeTruthy();
  });

  it("context menu Accept Left Side keeps right side pending", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.contextMenu(
      within(screen.getByTestId("pane-center")).getByText("b"),
    );
    fireEvent.click(screen.getByTestId("merge-context-accept-local"));

    expect(screen.queryByTestId("merge-context-menu")).toBeNull();
    const center = screen.getByTestId("pane-center");
    expect(within(center).getByText("ours")).toBeTruthy();
    expect(screen.getByText(/1 conflict\./i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      within(screen.getByTestId("pane-right")).getByLabelText("accept-right"),
    ).toBeTruthy();
  });

  it("context menu Resolve Using Left finishes the active conflict", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.contextMenu(
      within(screen.getByTestId("pane-center")).getByText("b"),
    );
    fireEvent.click(screen.getByTestId("merge-context-resolve-local"));

    const center = screen.getByTestId("pane-center");
    expect(within(center).getByText("ours")).toBeTruthy();
    expect(within(center).queryByText("theirs")).toBeNull();
    expect(screen.getByText(/0 conflict/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("resolved conflict context menu shows only Reset", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.contextMenu(
      within(screen.getByTestId("pane-center")).getByText("b"),
    );
    fireEvent.click(screen.getByTestId("merge-context-resolve-local"));

    fireEvent.contextMenu(
      within(screen.getByTestId("pane-center")).getByText("ours"),
    );

    expect(screen.getByTestId("merge-context-reset")).toBeTruthy();
    expect(screen.queryByTestId("merge-context-accept-local")).toBeNull();
    expect(screen.queryByTestId("merge-context-append-local")).toBeNull();
    expect(screen.queryByTestId("merge-context-ignore-local")).toBeNull();
    expect(screen.queryByTestId("merge-context-resolve-local")).toBeNull();
  });

  it("context menu Reset restores the unresolved base result", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.contextMenu(
      within(screen.getByTestId("pane-center")).getByText("b"),
    );
    fireEvent.click(screen.getByTestId("merge-context-accept-local"));
    fireEvent.contextMenu(
      within(screen.getByTestId("pane-center")).getByText("ours"),
    );
    fireEvent.click(screen.getByTestId("merge-context-reset"));

    const center = screen.getByTestId("pane-center");
    expect(within(center).getByText("b")).toBeTruthy();
    expect(screen.getByText(/1 conflict\./i)).toBeTruthy();
  });

  it("Cancel with dirty edits requests host confirm before discarding", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    useGitViewStore.setState({
      activeDocument: { ...doc, dirty: true },
    });

    render(<MergeResolverScreen />);
    fireEvent.click(screen.getByTestId("merge-cancel"));

    expect(findMergeTestMessage("merge.confirmDiscard")).toMatchObject({
      type: "merge.confirmDiscard",
      payload: { repoId: "test-repo", action: { action: "backToList" } },
    });
    expect(useGitViewStore.getState().activeDocument?.relativePath).toBe(
      "src/app.ts",
    );
    expect(screen.getByTestId("pane-left")).toBeTruthy();
  });

  it("Cancel on a clean document returns to the conflict list without confirm", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");

    render(<MergeResolverScreen />);
    fireEvent.click(screen.getByTestId("merge-cancel"));

    expect(posted).toEqual([]);
    expect(useGitViewStore.getState().activeDocument).toBeNull();
    expect(useGitViewStore.getState().screen).toBe("conflictList");
  });
});
