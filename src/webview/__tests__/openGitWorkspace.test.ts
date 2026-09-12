import { describe, it, expect, vi, beforeEach } from "vitest";

const { vscodeState, showWarningMessage, executeCommand, openGitWorkspacePanel } =
  vi.hoisted(() => ({
    vscodeState: { isTrusted: true },
    showWarningMessage: vi.fn(async () => undefined as string | undefined),
    executeCommand: vi.fn(async () => undefined),
    openGitWorkspacePanel: vi.fn(async () => undefined),
  }));

vi.mock("vscode", () => ({
  workspace: {
    get isTrusted() {
      return vscodeState.isTrusted;
    },
  },
  window: { showWarningMessage },
  commands: { executeCommand },
}));

vi.mock("../gitWorkspacePanel", () => ({
  openGitWorkspacePanel,
}));

import { openGitWorkspace } from "../openGitWorkspace";

const context = {
  extensionUri: { path: "/ext" },
  subscriptions: [],
} as unknown as import("vscode").ExtensionContext;

const gitView = {} as unknown as import("../../activation").GitViewContext;

describe("openGitWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vscodeState.isTrusted = true;
  });

  it("opens the panel without prompting when the workspace is trusted", async () => {
    await openGitWorkspace(context, gitView);

    expect(openGitWorkspacePanel).toHaveBeenCalledOnce();
    expect(showWarningMessage).not.toHaveBeenCalled();
  });

  it("blocks the panel and warns when the workspace is untrusted", async () => {
    vscodeState.isTrusted = false;

    await openGitWorkspace(context, gitView);

    expect(showWarningMessage).toHaveBeenCalledOnce();
    expect(openGitWorkspacePanel).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("opens workspace trust management when the user accepts the warning", async () => {
    vscodeState.isTrusted = false;
    showWarningMessage.mockResolvedValueOnce("Manage Workspace Trust");

    await openGitWorkspace(context, gitView);

    expect(executeCommand).toHaveBeenCalledWith("workbench.trust.manage");
    expect(openGitWorkspacePanel).not.toHaveBeenCalled();
  });

  it("leaves trust alone when the user dismisses the warning", async () => {
    vscodeState.isTrusted = false;
    showWarningMessage.mockResolvedValueOnce(undefined);

    await openGitWorkspace(context, gitView);

    expect(executeCommand).not.toHaveBeenCalled();
    expect(openGitWorkspacePanel).not.toHaveBeenCalled();
  });
});
