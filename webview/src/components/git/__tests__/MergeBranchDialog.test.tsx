// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import { MergeBranchDialog } from "../MergeBranchDialog";

const BRANCHES: BranchEntry[] = [
  {
    repoId: "r",
    name: "main",
    fullName: "main",
    remote: false,
    current: true,
    upstream: null,
    headSha: null,
  },
  {
    repoId: "r",
    name: "feature",
    fullName: "feature",
    remote: false,
    current: false,
    upstream: null,
    headSha: null,
  },
];

function renderDialog(onConfirm: () => void, branchRef = "feature") {
  render(
    <MergeBranchDialog
      open
      branches={BRANCHES}
      branchRef={branchRef}
      currentBranch="main"
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
}

describe("MergeBranchDialog", () => {
  afterEach(() => cleanup());

  it("confirms a plain merge", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.click(screen.getByTestId("merge-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("feature", {});
  });

  it("passes no-ff and log options", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.click(screen.getByTestId("merge-no-ff"));
    fireEvent.click(screen.getByTestId("merge-log"));
    fireEvent.click(screen.getByTestId("merge-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("feature", {
      noFf: true,
      log: true,
    });
  });

  it("drops the commit message when the merge is left uncommitted", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.change(screen.getByTestId("merge-message"), {
      target: { value: "Merged by hand" },
    });
    fireEvent.click(screen.getByTestId("merge-no-commit"));
    fireEvent.click(screen.getByTestId("merge-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("feature", { noCommit: true });
  });

  it("requires a source branch when none was preselected", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm, "");
    expect(screen.getByTestId("merge-branch-confirm")).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByTestId("merge-branch-ref"), {
      target: { value: "feature" },
    });
    fireEvent.click(screen.getByTestId("merge-branch-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("feature", {});
  });
});
