// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DeleteReviewSourceBranchDialog } from "../DeleteReviewSourceBranchDialog";

describe("DeleteReviewSourceBranchDialog", () => {
  afterEach(() => cleanup());

  it("confirms delete of merged source branch", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteReviewSourceBranchDialog
        open
        branchName="feature/login"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText(/feature\/login/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("delete-review-source-branch-confirm"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("cancels without confirming", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteReviewSourceBranchDialog
        open
        branchName="feature"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId("delete-review-source-branch-cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});