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
  it("requires the exact typed value and submits host evidence", async () => {
    const onConfirm = vi.fn();
    render(
      <RollbackConfirmDialog
        open
        confirmation={evidence}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const input = screen.getByTestId("rollback-typed-value");
    const confirm = screen.getByTestId("rollback-confirm");
    expect(confirm).toHaveProperty("disabled", true);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId("rollback-cancel")),
    );

    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({
      evidence,
      typedValue: "DELETE",
    });
  });

  it("clears typed input when stale evidence is replaced", () => {
    const { rerender } = render(
      <RollbackConfirmDialog
        open
        confirmation={evidence}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const input = screen.getByTestId("rollback-typed-value") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "DELETE" } });

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

    expect(input.value).toBe("");
    expect(screen.getByTestId("rollback-confirm")).toHaveProperty(
      "disabled",
      true,
    );
  });
});
