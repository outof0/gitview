// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ForceCheckoutConfirmationEvidence,
  MultiRootForceCheckoutConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { ForceCheckoutDialog } from "../ForceCheckoutDialog";

const repository = {
  headSha: "abc123456",
  currentBranch: "main",
  dirty: true,
  conflictCount: 0,
  changeDigest: null,
  operation: "none" as const,
};

const single: ForceCheckoutConfirmationEvidence = {
  version: 1,
  action: "force_checkout",
  repoId: "repo-1",
  targetRef: "feature",
  targetSha: "def456789",
  expectedTypedValue: "feature",
  repository,
};

const multi: MultiRootForceCheckoutConfirmationEvidence = {
  version: 1,
  action: "force_checkout_multi",
  repoId: "repo-1",
  targetRef: "feature",
  targets: [
    { repoId: "repo-1", targetSha: "def456789", repository },
    {
      repoId: "repo-2",
      targetSha: "987654321",
      repository: { ...repository, currentBranch: "develop" },
    },
  ],
  expectedTypedValue: "feature",
  repository,
};

afterEach(cleanup);

describe("ForceCheckoutDialog", () => {
  it("requires the target ref and submits host evidence", () => {
    const onConfirm = vi.fn();
    render(
      <ForceCheckoutDialog
        open
        confirmation={single}
        repositoryNames={["one"]}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirm = screen.getByTestId("force-checkout-confirm");
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByTestId("force-checkout-typed-value"), {
      target: { value: "feature" },
    });
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({
      evidence: single,
      typedValue: "feature",
    });
  });

  it("shows every affected repository and clears stale input", () => {
    const { rerender } = render(
      <ForceCheckoutDialog
        open
        confirmation={multi}
        repositoryNames={["one", "two"]}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText("one")).toBeTruthy();
    expect(screen.getByText("two")).toBeTruthy();
    const input = screen.getByTestId(
      "force-checkout-typed-value",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "feature" } });

    rerender(
      <ForceCheckoutDialog
        open
        confirmation={{
          ...multi,
          targets: [
            multi.targets[0]!,
            { ...multi.targets[1]!, targetSha: "moved" },
          ],
        }}
        repositoryNames={["one", "two"]}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(input.value).toBe("");
    expect(screen.getByTestId("force-checkout-confirm")).toHaveProperty(
      "disabled",
      true,
    );
  });
});
