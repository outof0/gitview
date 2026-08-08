// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { GIT_PANEL_SURFACES, PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { GitWorkspaceApp } from "../GitWorkspaceApp";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

const posted: unknown[] = [];

/** The surface each native Git submenu entry must open in the panel. */
const DIALOG_TEST_IDS: Record<string, string> = {
  stash: "stash-changes-dialog",
  unstash: "unstash-dialog",
  createBranch: "create-branch-dialog",
  merge: "merge-branch-dialog",
  rebase: "rebase-onto-dialog",
  commit: "commit-dialog",
  branches: "branches-popup",
};

function sendOpenDialog(dialog: string) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        protocolVersion: PROTOCOL_VERSION,
        type: "git.openDialog",
        payload: { dialog },
      },
    }),
  );
}

beforeEach(() => {
  posted.length = 0;
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) => posted.push(msg),
    getState: () => null,
    setState: () => {},
  });
});

afterEach(() => {
  cleanup();
  useGitWorkspaceStore.setState({
    dialogs: {},
    branchesOpen: false,
    nativeFocusSurface: null,
  });
});

describe("native Git submenu → panel dialog", () => {
  it("covers every surface the host is allowed to request", () => {
    expect(Object.keys(DIALOG_TEST_IDS).sort()).toEqual(
      [...GIT_PANEL_SURFACES].sort(),
    );
  });

  for (const dialog of GIT_PANEL_SURFACES) {
    it(`opens the ${dialog} dialog`, async () => {
      render(<GitWorkspaceApp />);
      sendOpenDialog(dialog);
      await waitFor(() => {
        expect(screen.getByTestId(DIALOG_TEST_IDS[dialog]!)).toBeTruthy();
      });
    });
  }

  it("replaces the open dialog instead of stacking a second one", async () => {
    render(<GitWorkspaceApp />);
    sendOpenDialog("stash");
    await waitFor(() => {
      expect(screen.getByTestId("stash-changes-dialog")).toBeTruthy();
    });

    sendOpenDialog("createBranch");
    await waitFor(() => {
      expect(screen.getByTestId("create-branch-dialog")).toBeTruthy();
    });
    expect(screen.queryByTestId("stash-changes-dialog")).toBeNull();
  });

  it("swaps between a dialog and the branches popup in both directions", async () => {
    render(<GitWorkspaceApp />);
    sendOpenDialog("unstash");
    await waitFor(() => {
      expect(screen.getByTestId("unstash-dialog")).toBeTruthy();
    });

    sendOpenDialog("branches");
    await waitFor(() => {
      expect(screen.getByTestId("branches-popup")).toBeTruthy();
    });
    expect(screen.queryByTestId("unstash-dialog")).toBeNull();

    sendOpenDialog("createBranch");
    await waitFor(() => {
      expect(screen.getByTestId("create-branch-dialog")).toBeTruthy();
    });
    expect(screen.queryByTestId("branches-popup")).toBeNull();
  });

  it("hides the workspace behind a menu-opened dialog until it closes", async () => {
    render(<GitWorkspaceApp />);
    sendOpenDialog("createBranch");
    await waitFor(() => {
      expect(screen.getByTestId("git-native-dialog-backdrop")).toBeTruthy();
    });

    useGitWorkspaceStore.getState().closeDialog("createBranch");
    await waitFor(() => {
      expect(screen.queryByTestId("git-native-dialog-backdrop")).toBeNull();
    });
  });

  it("leaves the workspace visible for a dialog opened in the panel itself", async () => {
    render(<GitWorkspaceApp />);
    useGitWorkspaceStore.getState().openDialog("createBranch", {
      startPoint: "",
    });
    await waitFor(() => {
      expect(screen.getByTestId("create-branch-dialog")).toBeTruthy();
    });
    expect(screen.queryByTestId("git-native-dialog-backdrop")).toBeNull();
  });
});
