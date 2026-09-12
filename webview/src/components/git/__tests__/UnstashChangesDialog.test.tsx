// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { StashDetail, StashEntry } from "@gitview/shared/types/stash";
import { UnstashChangesDialog } from "../stash/UnstashChangesDialog";

const stashes: StashEntry[] = [
  {
    index: 0,
    ref: "stash@{0}",
    branch: "main",
    message: "wip work",
    sha: "abc1234",
    authoredAt: "2026-01-01T00:00:00Z",
    relativeDate: "2 hours ago",
  },
];

const detail: StashDetail = {
  repoId: "repo-1",
  index: 0,
  ref: "stash@{0}",
  sha: "abc1234",
  branch: "main",
  message: "wip work",
  authoredAt: "2026-01-01T00:00:00Z",
  hasUntracked: false,
  files: [
    {
      path: "pod-ai/graphql/schema.ts",
      oldPath: null,
      status: "M",
      origin: "tracked",
    },
    {
      path: "pod-ai/stores/custom-options.ts",
      oldPath: null,
      status: "M",
      origin: "tracked",
    },
  ],
  indexFiles: [],
  refreshedAt: 0,
};

function renderDialog(overrides: Partial<Parameters<typeof UnstashChangesDialog>[0]> = {}) {
  const props = {
    open: true,
    stashes,
    currentBranch: "main",
    detail: null,
    fileDiff: null,
    selectedIndex: 0,
    onSelectStash: vi.fn(),
    selectedFile: null,
    onSelectFile: vi.fn(),
    onApply: vi.fn(),
    onPop: vi.fn(),
    onDrop: vi.fn(),
    onBranch: vi.fn(),
    onClear: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<UnstashChangesDialog {...props} />);
  return props;
}

describe("UnstashChangesDialog", () => {
  afterEach(() => cleanup());

  it("applies the selected stash by default", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("unstash-confirm"));

    expect(props.onApply).toHaveBeenCalledWith(0, { reinstateIndex: undefined });
    expect(props.onBranch).not.toHaveBeenCalled();
  });

  it("pops with the index reinstated when both boxes are ticked", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("unstash-pop"));
    fireEvent.click(screen.getByTestId("unstash-reinstate-index"));
    fireEvent.click(screen.getByTestId("unstash-confirm"));

    expect(props.onPop).toHaveBeenCalledWith(0, { reinstateIndex: true });
  });

  it("creates a branch instead of applying when a branch name is entered", () => {
    const props = renderDialog();

    fireEvent.change(screen.getByTestId("unstash-new-branch"), {
      target: { value: "  feature/from-stash  " },
    });
    expect(screen.getByTestId("unstash-confirm").textContent).toBe(
      "Create Branch",
    );

    fireEvent.click(screen.getByTestId("unstash-confirm"));

    expect(props.onBranch).toHaveBeenCalledWith(0, "feature/from-stash");
    expect(props.onApply).not.toHaveBeenCalled();
    expect(props.onPop).not.toHaveBeenCalled();
  });

  it("requires a second click before clearing every stash", () => {
    const props = renderDialog();

    fireEvent.click(screen.getByTestId("unstash-clear"));
    expect(props.onClear).not.toHaveBeenCalled();
    expect(screen.getByTestId("unstash-clear").textContent).toBe(
      "Delete all 1?",
    );

    fireEvent.click(screen.getByTestId("unstash-clear"));
    expect(props.onClear).toHaveBeenCalled();
  });

  it("disables Clear when there is nothing to clear", () => {
    renderDialog({ stashes: [], selectedIndex: null });

    expect(
      screen.getByTestId<HTMLButtonElement>("unstash-clear").disabled,
    ).toBe(true);
  });

  it("shows changed files as a tree by default and supports flat view", () => {
    renderDialog({ detail });

    expect(screen.getByTestId("stash-file-tree")).toBeTruthy();
    expect(screen.getByTestId("stash-folder-pod-ai")).toBeTruthy();
    expect(screen.getByTestId("stash-folder-pod-ai/graphql")).toBeTruthy();

    fireEvent.click(screen.getByTestId("stash-view-mode-flat"));

    expect(screen.queryByTestId("stash-file-tree")).toBeNull();
    expect(screen.getByTestId("stash-file-pod-ai/graphql/schema.ts")).toBeTruthy();

    fireEvent.click(screen.getByTestId("stash-view-mode-tree"));

    expect(screen.getByTestId("stash-file-tree")).toBeTruthy();
  });
});
