// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DropCommitConfirmationEvidence,
  DropSelectedConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { DropSelectedConfirmDialog } from "../DropSelectedConfirmDialog";
import { RewriteHistoryConfirmDialog } from "../RewriteHistoryConfirmDialog";

const repository = {
  headSha: "abc123456",
  currentBranch: "main",
  dirty: false,
  conflictCount: 0,
  changeDigest: null,
  operation: "none" as const,
};

const dropCommitEvidence: DropCommitConfirmationEvidence = {
  version: 1,
  action: "drop_commit",
  repoId: "repo-1",
  targetSha: "def456789",
  expectedTypedValue: "def4567",
  repository,
};

const dropSelectedEvidence: DropSelectedConfirmationEvidence = {
  version: 1,
  action: "drop_selected",
  repoId: "repo-1",
  targetSha: "abc123456",
  path: "src/app.ts",
  selection: { hunkIndexes: [0], lines: [] },
  expectedTypedValue: "abc1234",
  repository,
};

afterEach(cleanup);

describe("typed log destructive dialogs", () => {
  it("submits exact typed commit-drop evidence", () => {
    const onConfirm = vi.fn();
    render(
      <RewriteHistoryConfirmDialog
        open
        sha="def456789"
        action="drop"
        confirmation={dropCommitEvidence}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirm = screen.getByTestId("rewrite-history-confirm");
    const input = screen.getByTestId("rewrite-history-typed-value");
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(input, { target: { value: "def4567" } });
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({
      evidence: dropCommitEvidence,
      typedValue: "def4567",
    });
  });

  it("clears selected-change input when evidence becomes stale", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DropSelectedConfirmDialog
        open
        sha="abc123456"
        path="src/app.ts"
        confirmation={dropSelectedEvidence}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );
    const input = screen.getByTestId(
      "drop-selected-typed-value",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc1234" } });
    expect(input.value).toBe("abc1234");

    rerender(
      <DropSelectedConfirmDialog
        open
        sha="abc123456"
        path="src/app.ts"
        confirmation={{
          ...dropSelectedEvidence,
          repository: { ...repository, headSha: "new-head" },
        }}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    expect(input.value).toBe("");
    expect(screen.getByTestId("drop-selected-confirm")).toHaveProperty(
      "disabled",
      true,
    );
  });
});
