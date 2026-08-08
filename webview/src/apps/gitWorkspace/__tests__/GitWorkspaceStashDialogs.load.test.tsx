// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import { GitWorkspaceDialogs } from "../GitWorkspaceDialogs";
import type { GitWorkspaceDialogState } from "../../../stores/gitWorkspaceDialogs";
import type { GitWorkspaceController } from "../gitWorkspaceControllerTypes";

afterEach(cleanup);

function renderDialogs(
  dialogs: GitWorkspaceDialogState,
  overrides: Partial<GitWorkspaceController> = {},
) {
  const loadStashes = vi.fn().mockResolvedValue(undefined);
  const ctx = {
    clientRef: { current: {} },
    activeRepo: { id: "repo-1", currentBranch: "main" },
    runMutation: vi.fn(),
    syncing: false,
    dialogs,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    stashSnapshot: null,
    selectedFilePath: null,
    commitScope: new Set<string>(),
    loadBranches: vi.fn().mockResolvedValue(undefined),
    loadStashes,
    ...overrides,
  } as unknown as GitWorkspaceController;
  render(<GitWorkspaceDialogs ctx={ctx} />);
  return loadStashes;
}

describe("stash dialog loading", () => {
  it("fetches the stash list when a dialog opens without a snapshot", () => {
    const loadStashes = renderDialogs({ unstash: { index: null } });

    expect(loadStashes).toHaveBeenCalled();
  });

  it("does not refetch when a snapshot is already present", () => {
    const loadStashes = renderDialogs(
      { unstash: { index: null } },
      {
        stashSnapshot: {
          repoId: "repo-1",
          stashes: [],
          refreshedAt: 0,
        } satisfies StashListSnapshot,
      },
    );

    expect(loadStashes).not.toHaveBeenCalled();
  });

  it("stays idle while no dialog is open", () => {
    const loadStashes = renderDialogs({});

    expect(loadStashes).not.toHaveBeenCalled();
  });

  it("closes the stash dialog only after the mutation succeeds", async () => {
    const pushStash = vi.fn().mockResolvedValue(undefined);
    const closeDialog = vi.fn();
    const runMutation = vi.fn(async (run: () => Promise<unknown>) => {
      await run();
    });
    renderDialogs(
      { stash: {} },
      {
        clientRef: { current: { pushStash } } as never,
        closeDialog,
        runMutation,
      },
    );

    fireEvent.click(screen.getByTestId("stash-changes-confirm"));

    await waitFor(() => expect(pushStash).toHaveBeenCalled());
    expect(closeDialog).toHaveBeenCalledWith("stash");
  });

  it("keeps the stash dialog open when the mutation fails", async () => {
    const closeDialog = vi.fn();
    const runMutation = vi.fn(async (run: () => Promise<unknown>) => {
      await run().catch(() => undefined);
    });
    renderDialogs(
      { stash: {} },
      {
        clientRef: {
          current: { pushStash: vi.fn().mockRejectedValue(new Error("failed")) },
        } as never,
        closeDialog,
        runMutation,
      },
    );

    fireEvent.click(screen.getByTestId("stash-changes-confirm"));

    await waitFor(() => expect(runMutation).toHaveBeenCalled());
    expect(closeDialog).not.toHaveBeenCalled();
    expect(screen.getByTestId("stash-changes-dialog")).toBeTruthy();
  });
});
