// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BranchesPopup } from "../BranchesPopup";
import type { BranchListSnapshot } from "@gitview/shared/types/branch";

const snapshot: BranchListSnapshot = {
  repoId: "repo-1",
  refreshedAt: Date.now(),
  branches: [
    {
      repoId: "repo-1",
      name: "main",
      fullName: "main",
      remote: false,
      current: true,
      upstream: null,
      headSha: "abc1234",
    },
    {
      repoId: "repo-1",
      name: "feature",
      fullName: "feature",
      remote: false,
      current: false,
      upstream: null,
      headSha: "def5678",
    },
    {
      repoId: "repo-1",
      name: "origin/dev",
      fullName: "origin/dev",
      remote: true,
      current: false,
      upstream: null,
      headSha: "aaa1111",
    },
  ],
};

describe("BranchesPopup", () => {
  afterEach(() => cleanup());

  it("renders local and remote branches", () => {
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByTestId("branches-local")).toBeTruthy();
    expect(screen.getByTestId("branches-remote")).toBeTruthy();
    expect(screen.getByTestId("branch-feature")).toBeTruthy();
    expect(screen.getByTestId("branch-origin/dev")).toBeTruthy();
  });

  it("checks out a branch with smart option", () => {
    const onCheckout = vi.fn();
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={onCheckout}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("branch-feature"));
    expect(onCheckout).toHaveBeenCalledWith("feature", {
      smart: true,
      force: false,
    });
  });

  it("offers compare actions from the branch menu", () => {
    const onCompareWithCurrent = vi.fn();
    const onCompareWithWorkingTree = vi.fn();
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onCompareWithCurrent={onCompareWithCurrent}
        onCompareWithWorkingTree={onCompareWithWorkingTree}
      />,
    );
    fireEvent.click(screen.getByTestId("branch-menu-feature"));
    fireEvent.click(screen.getByTestId("branch-compare-current-feature"));
    fireEvent.click(screen.getByTestId("branch-menu-feature"));
    fireEvent.click(screen.getByTestId("branch-compare-working-tree-feature"));
    expect(onCompareWithCurrent).toHaveBeenCalledWith(snapshot.branches[1]);
    expect(onCompareWithWorkingTree).toHaveBeenCalledWith(snapshot.branches[1]);
  });

  it("offers merge and rebase actions from the branch menu", () => {
    const onMergeIntoCurrent = vi.fn();
    const onRebaseOnto = vi.fn();
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onMergeIntoCurrent={onMergeIntoCurrent}
        onRebaseOnto={onRebaseOnto}
      />,
    );
    fireEvent.click(screen.getByTestId("branch-menu-feature"));
    fireEvent.click(screen.getByTestId("branch-merge-feature"));
    fireEvent.click(screen.getByTestId("branch-menu-feature"));
    fireEvent.click(screen.getByTestId("branch-rebase-onto-feature"));
    expect(onMergeIntoCurrent).toHaveBeenCalledWith(snapshot.branches[1]);
    expect(onRebaseOnto).toHaveBeenCalledWith(snapshot.branches[1]);
  });

  it("creates a new branch from input", () => {
    const onCreate = vi.fn();
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={onCreate}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("new-branch-input"), {
      target: { value: "hotfix/1" },
    });
    fireEvent.click(screen.getByTestId("create-branch-button"));
    expect(onCreate).toHaveBeenCalledWith("hotfix/1");
  });

  it("blocks Create when the branch name is invalid", () => {
    const onCreate = vi.fn();
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={onCreate}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("new-branch-input"), {
      target: { value: "bad name" },
    });
    expect(screen.getByTestId("create-branch-button")).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByTestId("create-branch-button"));
    expect(onCreate).not.toHaveBeenCalled();
  });

  // Regression: section headers used to always render even when their section
  // was empty, so users could click "BRANCH", "COMPARE", or "INTEGRATE" and
  // nothing happened. Now the header is hidden unless at least one item below
  // it would be shown, and the kebab is disabled when no items would be
  // available at all.
  it("hides every section header when no handlers are passed and the branch is current", () => {
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    // The kebab would open a menu with no items, so it is disabled.
    expect(
      screen.getByTestId("branch-menu-main").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps the kebab enabled on a non-current branch when Checkout is the only available action", () => {
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    const kebab = screen.getByTestId("branch-menu-feature");
    expect(kebab.hasAttribute("disabled")).toBe(false);
    fireEvent.click(kebab);
    const panel = screen.getByTestId("branch-menu-panel-feature");
    // Branch section has Checkout; no other handlers were passed, so the
    // remaining sections must be hidden.
    expect(panel.querySelector('[data-section="Branch"]')).not.toBeNull();
    expect(panel.querySelector('[data-section="Compare"]')).toBeNull();
    expect(panel.querySelector('[data-section="Integrate"]')).toBeNull();
  });

  it("hides section headers for empty sections but keeps the one that has items", () => {
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onCompareWithCurrent={vi.fn()}
        onCompareWithWorkingTree={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("branch-menu-feature"));
    const panel = screen.getByTestId("branch-menu-panel-feature");
    // Both Branch and Compare have items now.
    expect(panel.querySelector('[data-section="Branch"]')).not.toBeNull();
    expect(panel.querySelector('[data-section="Compare"]')).not.toBeNull();
    // Integrate still has no items, so its header must not render.
    expect(panel.querySelector('[data-section="Integrate"]')).toBeNull();
  });
});