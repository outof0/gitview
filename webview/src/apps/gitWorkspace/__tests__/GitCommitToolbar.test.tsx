// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GitCommitToolbar } from "../GitCommitToolbar";

describe("GitCommitToolbar", () => {
  afterEach(() => cleanup());

  it("is a full-width icon toolbar and shows diff for the selection", () => {
    const onShowDiff = vi.fn();
    render(
      <GitCommitToolbar
        hasSelection
        onRefresh={vi.fn()}
        onRollback={vi.fn()}
        onShowDiff={onShowDiff}
      />,
    );

    expect(screen.getByTestId("commit-toolbar").className).toContain("w-full");
    expect(screen.queryByTestId("commit-toolbar-stage")).toBeNull();
    expect(screen.queryByTestId("commit-toolbar-unstage")).toBeNull();
    expect(screen.queryByTestId("commit-toolbar-move-to-changelist")).toBeNull();
    fireEvent.click(screen.getByTestId("commit-toolbar-diff"));
    expect(onShowDiff).toHaveBeenCalledOnce();
  });

  it("exposes expand and collapse actions for change groups", () => {
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    render(
      <GitCommitToolbar
        hasSelection={false}
        onRefresh={vi.fn()}
        onRollback={vi.fn()}
        onShowDiff={vi.fn()}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
      />,
    );

    fireEvent.click(screen.getByTestId("commit-toolbar-expand-all"));
    fireEvent.click(screen.getByTestId("commit-toolbar-collapse-all"));

    expect(onExpandAll).toHaveBeenCalledOnce();
    expect(onCollapseAll).toHaveBeenCalledOnce();
  });

  it("disables diff when only a rollback scope is selected", () => {
    render(
      <GitCommitToolbar
        hasSelection
        hasDiffSelection={false}
        onRefresh={vi.fn()}
        onRollback={vi.fn()}
        onShowDiff={vi.fn()}
      />,
    );

    expect(screen.getByTestId("commit-toolbar-diff")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("explains icon-only actions on hover", () => {
    render(
      <GitCommitToolbar
        hasSelection
        onRefresh={vi.fn()}
        onRollback={vi.fn()}
        onShowDiff={vi.fn()}
      />,
    );

    const rollback = screen.getByTestId("commit-toolbar-rollback");
    expect(rollback.getAttribute("aria-label")).toBe("Rollback selected change");
    fireEvent.mouseEnter(rollback.parentElement!);
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Rollback selected change",
    );
  });
});
