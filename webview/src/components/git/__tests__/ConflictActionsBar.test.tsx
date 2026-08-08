// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ConflictActionsBar } from "../ConflictActionsBar";

describe("ConflictActionsBar", () => {
  afterEach(() => cleanup());

  it("renders conflict actions for the selected file", () => {
    render(
      <ConflictActionsBar
        filePath="src/conflict.ts"
        onAcceptLocal={vi.fn()}
        onAcceptIncoming={vi.fn()}
        onOpenMerge={vi.fn()}
      />,
    );
    expect(screen.getByTestId("conflict-actions-bar")).toBeTruthy();
    expect(screen.getByText(/src\/conflict.ts/)).toBeTruthy();
    expect(screen.getByTestId("conflict-accept-local")).toBeTruthy();
    expect(screen.getByTestId("conflict-accept-incoming")).toBeTruthy();
    expect(screen.getByTestId("conflict-open-merge")).toBeTruthy();
  });

  it("invokes handlers when action buttons are clicked", () => {
    const onAcceptLocal = vi.fn();
    const onAcceptIncoming = vi.fn();
    const onOpenMerge = vi.fn();
    const onApplyNonConflicting = vi.fn();
    render(
      <ConflictActionsBar
        filePath="file.txt"
        onAcceptLocal={onAcceptLocal}
        onAcceptIncoming={onAcceptIncoming}
        onOpenMerge={onOpenMerge}
        onApplyNonConflicting={onApplyNonConflicting}
      />,
    );
    fireEvent.click(screen.getByTestId("conflict-accept-local"));
    fireEvent.click(screen.getByTestId("conflict-accept-incoming"));
    fireEvent.click(screen.getByTestId("conflict-apply-non-conflicting"));
    fireEvent.click(screen.getByTestId("conflict-open-merge"));
    expect(onAcceptLocal).toHaveBeenCalledTimes(1);
    expect(onAcceptIncoming).toHaveBeenCalledTimes(1);
    expect(onApplyNonConflicting).toHaveBeenCalledTimes(1);
    expect(onOpenMerge).toHaveBeenCalledTimes(1);
  });
});