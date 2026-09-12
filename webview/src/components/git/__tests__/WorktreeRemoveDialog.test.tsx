// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RemoveDirtyWorktreeConfirmationEvidence } from "@gitview/shared/types/confirmation";
import { WorktreeRemoveDialog } from "../WorktreeRemoveDialog";

const confirmation: RemoveDirtyWorktreeConfirmationEvidence = {
  version: 1,
  action: "remove_dirty_worktree",
  repoId: "repo-1",
  target: {
    path: "/repo-worktree",
    headSha: "def456789",
    branch: "feature",
    dirty: true,
  },
  expectedTypedValue: "/repo-worktree",
  repository: {
    headSha: "abc123456",
    currentBranch: "main",
    dirty: false,
    conflictCount: 0,
    changeDigest: null,
    operation: "none",
  },
};

afterEach(cleanup);

describe("WorktreeRemoveDialog", () => {
  it("requires the canonical path and submits host evidence", async () => {
    const onConfirm = vi.fn();
    render(
      <WorktreeRemoveDialog
        open
        confirmation={confirmation}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirm = screen.getByTestId("worktree-remove-confirm");
    expect(confirm).toHaveProperty("disabled", true);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByTestId("worktree-remove-cancel"),
      ),
    );
    fireEvent.change(screen.getByTestId("worktree-remove-typed-value"), {
      target: { value: "/repo-worktree" },
    });
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({
      evidence: confirmation,
      typedValue: "/repo-worktree",
    });
  });

  it("clears stale input when the target worktree changes", () => {
    const { rerender } = render(
      <WorktreeRemoveDialog
        open
        confirmation={confirmation}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const input = screen.getByTestId(
      "worktree-remove-typed-value",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/repo-worktree" } });

    rerender(
      <WorktreeRemoveDialog
        open
        confirmation={{
          ...confirmation,
          target: { ...confirmation.target, headSha: "moved" },
        }}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(input.value).toBe("");
    expect(screen.getByTestId("worktree-remove-confirm")).toHaveProperty(
      "disabled",
      true,
    );
  });
});
