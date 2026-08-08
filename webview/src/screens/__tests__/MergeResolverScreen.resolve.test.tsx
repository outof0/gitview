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
import { renderHook } from "@testing-library/react";
import { useManualEdit } from "../../hooks/useManualEdit";
import { loadDoc, posted } from "./mergeResolverScreen.testSetup";

describe("MergeResolverScreen", () => {
  it("accept-right keeps local side pending until handled", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.click(
      within(screen.getByTestId("pane-right")).getByLabelText("accept-right"),
    );

    const doc = useGitViewStore.getState().activeDocument!;
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(conflict.status).toBe("unresolved");
    expect(conflict.resultText).toBe("theirs");
    expect(conflict.metadata.conflict).toEqual({
      ours: "pending",
      theirs: "accepted",
      acceptedOrder: ["theirs"],
    });
  });

  it("append action preserves the already accepted side", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const left = screen.getByTestId("pane-left");
    const right = screen.getByTestId("pane-right");
    fireEvent.click(within(left).getByLabelText("accept-left"));

    const appendRight = within(right).getByLabelText("accept-right");
    expect(appendRight.getAttribute("title")).toBe("Append Right Side");

    fireEvent.click(appendRight);

    const updated = useGitViewStore.getState().activeDocument!;
    const updatedConflict = updated.blocks.find((b) => b.kind === "conflict")!;
    expect(updatedConflict.status).toBe("accepted_both");
    expect(updatedConflict.resultText).toBe("ours\ntheirs");
  });

  it("ignore handles only one side until the other side is handled", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    fireEvent.click(
      within(screen.getByTestId("pane-left")).getByLabelText("ignore"),
    );

    const doc = useGitViewStore.getState().activeDocument!;
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(conflict.status).toBe("unresolved");
    expect(conflict.resultText).toBe("b");
    expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
  });

  it("manual center edit resolves an unresolved conflict as manual", () => {
    const doc = loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    const { result } = renderHook(() => useManualEdit());

    result.current.applyManualEditToBlock(conflict.id, "manual");

    const updated = useGitViewStore.getState().activeDocument!;
    const block = updated.blocks.find((b) => b.id === conflict.id)!;
    expect(block.status).toBe("manual");
    expect(block.resultText).toBe("manual");
  });

  it("toolbar conflict counter stays until the remaining side is handled", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    // Before: one unresolved conflict shown in the toolbar counter.
    expect(screen.getByText(/1 conflict\./i)).toBeTruthy();

    const left = screen.getByTestId("pane-left");
    const right = screen.getByTestId("pane-right");
    fireEvent.click(within(left).getByLabelText("accept-left"));

    expect(screen.getByText(/1 conflict\./i)).toBeTruthy();
    expect(screen.queryByText(/0 conflict/i)).toBeNull();

    fireEvent.click(within(right).getByLabelText("ignore"));

    expect(screen.getByText(/0 conflict/i)).toBeTruthy();
    expect(screen.queryByText(/1 conflict\./i)).toBeNull();
  });

  it("shows append or ignore actions after accepting one side", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const left = screen.getByTestId("pane-left");
    const right = screen.getByTestId("pane-right");
    const center = screen.getByTestId("pane-center");

    fireEvent.click(within(left).getByLabelText("accept-left"));

    const leftRow = within(left).getByText("ours").closest(".nx-row");
    const rightRow = within(right).getByText("theirs").closest(".nx-row");

    expect(leftRow?.classList.contains("nx-resolved")).toBe(true);
    expect(within(center).getByText("ours")).toBeTruthy();
    expect(center.querySelector('[data-type="conflict"]')).toBeTruthy();
    expect(rightRow?.classList.contains("nx-conflict")).toBe(true);
    expect(within(left).queryByLabelText("accept-left")).toBeNull();
    expect(within(left).queryByLabelText("ignore")).toBeNull();
    expect(
      within(right).getByLabelText("accept-right").getAttribute("title"),
    ).toBe("Append Right Side");
    expect(within(right).getByLabelText("ignore")).toBeTruthy();
  });

  it("shows ignored styling on both side panes when both sides are ignored back to base", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const left = screen.getByTestId("pane-left");
    const right = screen.getByTestId("pane-right");
    const center = screen.getByTestId("pane-center");

    fireEvent.click(within(left).getByLabelText("ignore"));
    fireEvent.click(within(right).getByLabelText("ignore"));

    expect(
      within(left)
        .getByText("ours")
        .closest(".nx-row")
        ?.classList.contains("nx-ignored"),
    ).toBe(true);
    expect(
      within(right)
        .getByText("theirs")
        .closest(".nx-row")
        ?.classList.contains("nx-ignored"),
    ).toBe(true);
    expect(within(center).getByText("b")).toBeTruthy();
    expect(center.querySelector('[data-type="conflict"]')).toBeNull();
    expect(useGitViewStore.getState().remainingConflicts()).toBe(0);
  });

  it("Apply posts merge:markResolved with the serialized result", () => {
    loadDoc("a\nb\nc\n", "a\nours\nc\n", "a\ntheirs\nc\n");
    render(<MergeResolverScreen />);

    const right = screen.getByTestId("pane-right");
    fireEvent.click(within(right).getByLabelText("accept-right"));
    fireEvent.click(
      within(screen.getByTestId("pane-left")).getByLabelText("ignore"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved).toBeDefined();
    const payload = resolved!.payload as {
      path: string;
      content: string;
    };
    expect(payload.path).toBe("src/app.ts");
    expect(payload.content).toContain("theirs");
    expect(payload.content).not.toContain("ours");
    expect(payload.content).not.toContain("<<<<<<<");
  });
});
