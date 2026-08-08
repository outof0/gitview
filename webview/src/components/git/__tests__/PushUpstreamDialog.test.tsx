// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PushUpstreamDialog } from "../PushUpstreamDialog";

describe("PushUpstreamDialog", () => {
  afterEach(() => cleanup());

  it("shows upstream setup confirmation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <PushUpstreamDialog
        open
        branchName="feature/login"
        remote="origin"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId("push-upstream-dialog")).toBeTruthy();
    expect(screen.getByText(/Set upstream and push/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("push-upstream-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});