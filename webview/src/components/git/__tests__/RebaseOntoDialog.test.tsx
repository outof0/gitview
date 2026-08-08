// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import { RebaseOntoDialog } from "../RebaseOntoDialog";

const BRANCHES: BranchEntry[] = [
  {
    repoId: "r",
    name: "main",
    fullName: "main",
    remote: false,
    current: false,
    upstream: null,
    headSha: null,
  },
  {
    repoId: "r",
    name: "feature",
    fullName: "feature",
    remote: false,
    current: true,
    upstream: null,
    headSha: null,
  },
];

function renderDialog(onConfirm: () => void, ontoRef = "main") {
  render(
    <RebaseOntoDialog
      open
      branches={BRANCHES}
      ontoRef={ontoRef}
      currentBranch="feature"
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
}

describe("RebaseOntoDialog", () => {
  afterEach(() => cleanup());

  it("confirms rebase onto target", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.click(screen.getByTestId("rebase-onto-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("main", {});
  });

  it("passes interactive and merge-preserving options", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.click(screen.getByTestId("rebase-interactive"));
    fireEvent.click(screen.getByTestId("rebase-merges"));
    fireEvent.click(screen.getByTestId("rebase-onto-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("main", {
      interactive: true,
      rebaseMerges: true,
    });
  });

  it("rebases a branch other than the current one", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    fireEvent.change(screen.getByTestId("rebase-from-ref"), {
      target: { value: "feature" },
    });
    fireEvent.click(screen.getByTestId("rebase-onto-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("main", { from: "feature" });
  });

  it("requires a target when none was preselected", () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm, "");
    expect(screen.getByTestId("rebase-onto-confirm")).toHaveProperty("disabled", true);
  });
});
