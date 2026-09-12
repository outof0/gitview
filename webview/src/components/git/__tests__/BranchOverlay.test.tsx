// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { BranchOverlay } from "../BranchOverlay";
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
  ],
};

function clientStub() {
  return {
    listBranches: vi.fn(async () => snapshot),
    createBranch: vi.fn(async () => ({ name: "feature" })),
    checkoutBranch: vi.fn(async () => ({ ref: "main" })),
  };
}

describe("BranchOverlay", () => {
  afterEach(() => cleanup());

  it("loads branches and renders the create dialog", async () => {
    const client = clientStub();
    render(
      <BranchOverlay
        request={{ surface: "createBranch", repoId: "repo-1" }}
        client={client}
        onClose={vi.fn()}
      />,
    );

    expect(client.listBranches).toHaveBeenCalledWith("repo-1");
    await waitFor(() => {
      expect(screen.getByTestId("create-branch-dialog")).toBeTruthy();
    });
  });

  it("renders the branches popup for the branches surface", async () => {
    const client = clientStub();
    render(
      <BranchOverlay
        request={{ surface: "branches", repoId: "repo-1" }}
        client={client}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("branches-popup")).toBeTruthy();
    });
  });

  it("shows an error banner when the branch list fails", async () => {
    const client = clientStub();
    client.listBranches.mockRejectedValueOnce(new Error("offline"));
    render(
      <BranchOverlay
        request={{ surface: "createBranch", repoId: "repo-1" }}
        client={client}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("branch-overlay-error")).toBeTruthy();
    });
  });

  it("opens the typed confirmation dialog when force checkout is challenged", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const confirmation = {
      version: 1,
      action: "force_checkout",
      repoId: "repo-1",
      targetRef: "feature",
      targetSha: "def5678",
      expectedTypedValue: "feature",
      repository: {
        headSha: "abc1234",
        currentBranch: "main",
        dirty: true,
        conflictCount: 0,
        operation: "none",
        changeDigest: null,
      },
    };
    const challenged = Object.assign(
      new Error("Force checkout requires typed confirmation."),
      { code: "CONFIRMATION_REQUIRED", details: { confirmation } },
    );
    const featureSnapshot: BranchListSnapshot = {
      ...snapshot,
      branches: [
        ...snapshot.branches,
        {
          repoId: "repo-1",
          name: "feature",
          fullName: "feature",
          remote: false,
          current: false,
          upstream: null,
          headSha: "def5678",
        },
      ],
    };
    const client = clientStub();
    client.listBranches.mockResolvedValue(featureSnapshot);
    client.checkoutBranch.mockRejectedValueOnce(challenged);
    client.checkoutBranch.mockResolvedValueOnce({ ref: "feature" });
    const onClose = vi.fn();
    render(
      <BranchOverlay
        request={{ surface: "branches", repoId: "repo-1" }}
        client={client}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("branches-popup")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("force-checkout-toggle"));
    fireEvent.click(screen.getByTestId("branch-feature"));

    await waitFor(() => {
      expect(screen.getByTestId("force-checkout-dialog")).toBeTruthy();
    });
    expect(client.checkoutBranch).toHaveBeenCalledWith(
      "repo-1",
      "feature",
      expect.objectContaining({ force: true }),
    );

    fireEvent.change(screen.getByTestId("force-checkout-typed-value"), {
      target: { value: "feature" },
    });
    fireEvent.click(screen.getByTestId("force-checkout-confirm"));

    await waitFor(() => {
      expect(client.checkoutBranch).toHaveBeenCalledWith(
        "repo-1",
        "feature",
        expect.objectContaining({
          force: true,
          confirmation: { evidence: confirmation, typedValue: "feature" },
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });
});
