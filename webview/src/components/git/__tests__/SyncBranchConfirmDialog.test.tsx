// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SyncBranchConfirmDialog } from "../SyncBranchConfirmDialog";

describe("SyncBranchConfirmDialog", () => {
  afterEach(() => cleanup());

  it("lists affected repositories and confirms sync checkout", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <SyncBranchConfirmDialog
        open
        refName="shared-branch"
        targets={[
          {
            repoId: "a",
            name: "repo-a",
            available: true,
            currentBranch: "main",
          },
          {
            repoId: "b",
            name: "repo-b",
            available: false,
            currentBranch: "develop",
            unavailableReason: 'Branch "shared-branch" is not available in this repository.',
          },
        ]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId("sync-branch-dialog")).toBeTruthy();
    expect(screen.getByTestId("sync-branch-target-a")).toBeTruthy();
    expect(screen.getByTestId("sync-branch-skipped-b")).toBeTruthy();
    fireEvent.click(screen.getByTestId("sync-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});