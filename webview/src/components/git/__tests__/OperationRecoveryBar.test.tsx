// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OperationRecoveryBar } from "../OperationRecoveryBar";

describe("OperationRecoveryBar", () => {
  afterEach(() => cleanup());

  it("renders merge recovery actions", () => {
    const onContinue = vi.fn();
    const onAbort = vi.fn();
    render(
      <OperationRecoveryBar
        operation={{ type: "merge", canContinue: true, canAbort: true }}
        onContinue={onContinue}
        onAbort={onAbort}
      />,
    );

    expect(screen.getByTestId("operation-recovery-bar")).toBeTruthy();
    expect(screen.getByText("Merge in progress")).toBeTruthy();
    fireEvent.click(screen.getByTestId("operation-continue"));
    fireEvent.click(screen.getByTestId("operation-abort"));
    expect(onContinue).toHaveBeenCalled();
    expect(onAbort).toHaveBeenCalled();
    expect(screen.queryByTestId("operation-skip")).toBeNull();
  });

  it("renders cherry-pick skip but not for revert", () => {
    const onSkip = vi.fn();
    render(
      <OperationRecoveryBar
        operation={{
          type: "cherry_pick",
          canContinue: true,
          canSkip: true,
          canAbort: true,
        }}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByTestId("operation-skip"));
    expect(onSkip).toHaveBeenCalled();

    cleanup();
    render(
      <OperationRecoveryBar
        operation={{
          type: "revert",
          canContinue: true,
          canSkip: true,
          canAbort: true,
        }}
        onSkip={onSkip}
      />,
    );
    expect(screen.queryByTestId("operation-skip")).toBeNull();
  });

  it("exposes status semantics and aria labels on recovery actions", () => {
    render(
      <OperationRecoveryBar
        operation={{
          type: "rebase",
          canContinue: true,
          canSkip: true,
          canAbort: true,
        }}
        onContinue={vi.fn()}
        onAbort={vi.fn()}
      />,
    );
    expect(screen.getByTestId("operation-recovery-bar").getAttribute("role")).toBe(
      "status",
    );
    expect(screen.getByTestId("operation-continue").getAttribute("aria-label")).toBe(
      "Continue Git operation",
    );
    expect(screen.getByTestId("operation-abort").getAttribute("aria-label")).toBe(
      "Abort Git operation",
    );
  });

  it("returns null when no operation is active", () => {
    const { container } = render(
      <OperationRecoveryBar operation={{ type: "none" }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});