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
import { loadDoc } from "./mergeResolverScreen.testSetup";
describe("MergeResolverScreen", () => {
  it("renders three panes from the active document", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    expect(screen.getByTestId("pane-left")).toBeTruthy();
    expect(screen.getByTestId("pane-center")).toBeTruthy();
    expect(screen.getByTestId("pane-right")).toBeTruthy();
  });

  it("shows pane header branch labels from the document", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    expect(screen.getAllByText(doc.oursLabel).length).toBeGreaterThan(0);
    expect(screen.getAllByText(doc.theirsLabel).length).toBeGreaterThan(0);
  });

  it("renders full file content in side panes (not just conflicts)", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    const left = screen.getByTestId("pane-left");
    // Unchanged context lines appear too.
    expect(within(left).getAllByText("a").length).toBeGreaterThan(0);
    expect(within(left).getAllByText("ours").length).toBeGreaterThan(0);
  });

  it("disables Apply while a conflict is unresolved", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    const apply = screen.getByRole("button", { name: "Apply" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows merge close affordances without duplicate toolbar back", () => {
    // GitView merge flow: Cancel + Apply only (no separate Save button).
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    expect(screen.getByTestId("merge-title-close")).toBeTruthy();
    expect(screen.getByTestId("merge-cancel")).toBeTruthy();
    expect(screen.getByTestId("merge-apply")).toBeTruthy();
    expect(screen.queryByTestId("merge-save")).toBeNull();
    expect(screen.queryByLabelText("Back to list")).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept Left" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept Right" })).toBeNull();
  });

  it("enables Apply when all conflicts are resolved", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);
    fireEvent.click(
      within(screen.getByTestId("pane-right")).getByLabelText("accept-right"),
    );
    fireEvent.click(
      within(screen.getByTestId("pane-left")).getByLabelText("ignore"),
    );
    expect(
      (screen.getByTestId("merge-apply") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("clicking accept-left keeps right side available to append or ignore", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const left = screen.getByTestId("pane-left");
    const right = screen.getByTestId("pane-right");
    const acceptBtn = within(left).getByLabelText("accept-left");
    fireEvent.click(acceptBtn);

    const doc = useGitViewStore.getState().activeDocument!;
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(conflict.status).toBe("unresolved");
    expect(conflict.resultText).toBe("ours");
    expect(conflict.metadata.conflict).toEqual({
      ours: "accepted",
      theirs: "pending",
      acceptedOrder: ["ours"],
    });

    const apply = screen.getByRole("button", { name: "Apply" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(within(left).queryByLabelText("accept-left")).toBeNull();
    const appendRight = within(right).getByLabelText("accept-right");
    expect(appendRight.getAttribute("title")).toBe("Append Right Side");
    expect(within(right).getByLabelText("ignore")).toBeTruthy();
  });

  it("shows base text and conflict coloring in the unresolved result pane", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const center = screen.getByTestId("pane-center");

    expect(within(center).getByText("b")).toBeTruthy();
    expect(within(center).queryByText("ours")).toBeNull();
    expect(within(center).queryByText("theirs")).toBeNull();
    expect(center.querySelector('[data-type="conflict"]')).toBeTruthy();
  });

  it("ctrl-click accept-left behaves like normal accept", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.click(
      within(screen.getByTestId("pane-left")).getByLabelText("accept-left"),
      {
        ctrlKey: true,
      },
    );

    const doc = useGitViewStore.getState().activeDocument!;
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(conflict.status).toBe("unresolved");
    expect(conflict.resultText).toBe("ours");
    expect(conflict.metadata.conflict).toEqual({
      ours: "accepted",
      theirs: "pending",
      acceptedOrder: ["ours"],
    });
    expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
  });

  it("right-click on a side pane gutter opens context actions", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const { container } = render(<MergeResolverScreen />);

    const gutter = container.querySelector('[data-testid="pane-left"] .nx-ln');
    expect(gutter).toBeTruthy();
    fireEvent.contextMenu(gutter!);

    expect(
      screen.getByTestId("editor-context-menu-annotate-gutter"),
    ).toBeTruthy();
    expect(screen.getByTestId("git-menu-show-history")).toBeTruthy();
  });

});
