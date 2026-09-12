// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RollbackConfirmationEvidence } from "@gitview/shared/types/confirmation";
import { RollbackConfirmDialog } from "../RollbackConfirmDialog";

const evidence: RollbackConfirmationEvidence = {
  version: 1,
  action: "rollback",
  repoId: "repo-1",
  paths: ["tracked.ts", "untracked.txt"],
  unversionedPaths: ["untracked.txt"],
  expectedTypedValue: "DELETE",
  repository: {
    headSha: "abc123456",
    currentBranch: "main",
    dirty: true,
    conflictCount: 0,
    changeDigest: null,
    operation: "none",
  },
};

afterEach(cleanup);

describe("RollbackConfirmDialog", () => {
  it("confirms with one click and submits host evidence", async () => {
    const onConfirm = vi.fn();
    render(
      <RollbackConfirmDialog
        open
        confirmation={evidence}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirm = screen.getByTestId("rollback-confirm");
    expect(screen.queryByTestId("rollback-typed-value")).toBeNull();
    expect(confirm).toHaveProperty("disabled", false);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId("rollback-cancel")),
    );

    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({
      evidence,
      typedValue: "DELETE",
    });
  });

  it("updates the confirmation target when stale evidence is replaced", () => {
    const { rerender } = render(
      <RollbackConfirmDialog
        open
        confirmation={evidence}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    rerender(
      <RollbackConfirmDialog
        open
        confirmation={{
          ...evidence,
          unversionedPaths: [],
          expectedTypedValue: "ROLLBACK",
        }}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByTestId("rollback-confirm")).toHaveProperty(
      "disabled",
      false,
    );
  });
});
