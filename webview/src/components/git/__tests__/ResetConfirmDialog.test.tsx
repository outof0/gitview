// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HardResetConfirmationEvidence } from "@gitview/shared/types/confirmation";
import { ResetConfirmDialog } from "../ResetConfirmDialog";

const evidence: HardResetConfirmationEvidence = {
  version: 1,
  action: "hard_reset",
  repoId: "repo-1",
  targetSha: "target-sha",
  resetMode: "hard",
  expectedTypedValue: "main",
  repository: {
    headSha: "current-head",
    currentBranch: "main",
    dirty: true,
    conflictCount: 0,
    changeDigest: null,
    operation: "none",
  },
};

afterEach(cleanup);

describe("ResetConfirmDialog", () => {
  it("requires the exact typed value before submitting", () => {
    const onConfirm = vi.fn();
    render(
      <ResetConfirmDialog
        open
        sha="target-sha"
        mode="hard"
        confirmation={evidence}
        onModeChange={() => undefined}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirm = screen.getByTestId("reset-confirm");
    const input = screen.getByTestId("reset-typed-value");
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(input, { target: { value: "Main" } });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "main" } });
    expect(confirm).toHaveProperty("disabled", false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({
      evidence,
      typedValue: "main",
    });
  });

  it("clears typed input when host evidence changes", () => {
    const { rerender } = render(
      <ResetConfirmDialog
        open
        sha="target-sha"
        mode="hard"
        confirmation={evidence}
        onModeChange={() => undefined}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const input = screen.getByTestId("reset-typed-value") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "main" } });
    expect(input.value).toBe("main");

    rerender(
      <ResetConfirmDialog
        open
        sha="target-sha"
        mode="hard"
        confirmation={{
          ...evidence,
          repository: { ...evidence.repository, headSha: "new-head" },
        }}
        onModeChange={() => undefined}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(input.value).toBe("");
    expect(screen.getByTestId("reset-confirm")).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("focuses Cancel, closes on Escape, and restores trigger focus", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open reset
          </button>
          <ResetConfirmDialog
            open={open}
            sha="target-sha"
            mode="hard"
            confirmation={evidence}
            onModeChange={() => undefined}
            onConfirm={() => undefined}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open reset" });
    trigger.focus();
    fireEvent.click(trigger);
    const cancel = screen.getByTestId("reset-cancel");
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
