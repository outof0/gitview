import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  openGitHistoryPanel,
  openGitViewPanel,
  openGitViewBlamePanel,
  getGitViewOverlayTarget,
  openGitWorkspaceDialog,
  openGitCreateBranchPanel,
  openGitCommitPanel,
  openGitBranchesPanel,
  resolveRepoIdForResource,
  resolveRepoRoot,
} = vi.hoisted(() => ({
  openGitHistoryPanel: vi.fn(async () => undefined),
  openGitViewPanel: vi.fn(async () => undefined),
  openGitViewBlamePanel: vi.fn(async () => undefined),
  getGitViewOverlayTarget: vi.fn((): unknown => null),
  openGitWorkspaceDialog: vi.fn(async () => undefined),
  openGitCreateBranchPanel: vi.fn(async () => undefined),
  openGitCommitPanel: vi.fn(async () => undefined),
  openGitBranchesPanel: vi.fn(async () => undefined),
  resolveRepoIdForResource: vi.fn(async () => "resolved-repo" as string | null),
  resolveRepoRoot: vi.fn(async () => "/repo" as string | undefined),
}));

const vscodeWindow: {
  showErrorMessage: ReturnType<typeof vi.fn>;
  showInputBox: ReturnType<typeof vi.fn>;
  activeTextEditor: unknown;
} = vi.hoisted(() => ({
  showErrorMessage: vi.fn(async () => undefined),
  showInputBox: vi.fn(async () => undefined as string | undefined),
  activeTextEditor: undefined as unknown,
}));

vi.mock("vscode", () => ({
  window: vscodeWindow,
}));

vi.mock("../GitHistoryWebviewPanel", () => ({ openGitHistoryPanel }));
vi.mock("../gitViewPresentation", () => ({
  openGitViewPanel,
  openGitViewBlamePanel,
  getGitViewOverlayTarget,
}));
vi.mock("../gitWorkspacePanel", () => ({ openGitWorkspaceDialog }));
vi.mock("../gitCreateBranchPanel", () => ({ openGitCreateBranchPanel }));
vi.mock("../gitCommitPanel", () => ({ openGitCommitPanel }));
vi.mock("../gitBranchesPanel", () => ({ openGitBranchesPanel }));
vi.mock("../gitViewPanelRouter", () => ({ resolveRepoIdForResource }));
vi.mock("../../commands/gitMenuActionsHelpers", () => ({
  resolveRepoRoot,
}));

import type { GitDiffPreview } from "../../commands/gitMenuPresentation";
import { createGitMenuPresentation } from "../gitMenuPresentationAdapter";

const context = {
  extensionUri: { path: "/ext" },
  subscriptions: [],
} as unknown as import("vscode").ExtensionContext;

const gitView = {
  logger: { warn: vi.fn() },
} as unknown as import("../../activation").GitViewContext;

const preview = {
  relativePath: "src/app.ts",
  title: "src/app.ts",
  diff: {},
} as unknown as GitDiffPreview;

function presentation() {
  return createGitMenuPresentation(context, () => gitView);
}

function resetBranchSurfaces() {
  getGitViewOverlayTarget.mockReturnValue(null);
  vscodeWindow.activeTextEditor = undefined;
}

describe("createGitMenuPresentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepoIdForResource.mockResolvedValue("resolved-repo");
    resetBranchSurfaces();
  });

  it("forwards history requests with the workspace root", async () => {
    await presentation().openHistory({
      relativePath: "src/app.ts",
      isFolder: false,
      workspaceRoot: "/ws",
    });

    expect(openGitHistoryPanel).toHaveBeenCalledWith(
      context,
      gitView,
      "src/app.ts",
      false,
      "/ws",
    );
  });

  it("forwards diff requests with the shared logger", async () => {
    await presentation().openDiff({
      preview,
      workspaceRoot: "/ws",
      reusePanel: true,
    });

    expect(openGitViewPanel).toHaveBeenCalledWith(
      context,
      preview,
      "/ws",
      {
        reusePanel: true,
        openInActiveColumn: undefined,
        logger: gitView.logger,
        getGitView: expect.any(Function),
      },
    );
  });

  it("forwards blame requests with an empty line range", async () => {
    await presentation().openBlame({
      relativePath: "src/app.ts",
      workspaceRoot: "/ws",
      repoRoot: "/ws",
      focusLine: 12,
    });

    expect(openGitViewBlamePanel).toHaveBeenCalledWith(
      context,
      gitView,
      {
        relativePath: "src/app.ts",
        lines: [],
        loading: true,
        focusLine: 12,
      },
      "/ws",
      "/ws",
    );
  });

  it("forwards panel dialog requests", async () => {
    await presentation().openPanelDialog?.({ dialog: "commit" });

    expect(openGitWorkspaceDialog).toHaveBeenCalledWith(context, gitView, {
      dialog: "commit",
    });
  });

  it("uses the supplied repoId without resolving", async () => {
    await presentation().openCreateBranchDialog?.({
      workspaceRoot: "/ws",
      repoId: "explicit-repo",
      startPoint: "main",
    });

    expect(resolveRepoIdForResource).not.toHaveBeenCalled();
    expect(openGitCreateBranchPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "explicit-repo",
      workspaceRoot: "/ws",
      startPoint: "main",
    });
  });

  it("resolves the repoId from the workspace root when omitted", async () => {
    await presentation().openCreateBranchDialog?.({ workspaceRoot: "/ws" });

    expect(resolveRepoIdForResource).toHaveBeenCalledWith(gitView, "/ws", ".");
    expect(openGitCreateBranchPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
      startPoint: undefined,
    });
  });

  it("reports and gives up when no repository can be resolved", async () => {
    resolveRepoIdForResource.mockResolvedValueOnce(null);

    await presentation().openCreateBranchDialog?.({ workspaceRoot: "/ws" });

    expect(vscodeWindow.showErrorMessage).toHaveBeenCalledOnce();
    expect(openGitCreateBranchPanel).not.toHaveBeenCalled();
  });
});

// Regression: Commit used `openPanelDialog`, which sends only a dialog id, so a
// Commit opened from repo B's menu committed to whatever repo the panel had
// active. It also ran at the bottom panel's height, collapsing the dialog's
// file/diff split to 2px.
describe("createGitMenuPresentation.openCommitDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepoIdForResource.mockResolvedValue("resolved-repo");
    resetBranchSurfaces();
  });

  it("uses the supplied repoId without resolving", async () => {
    await presentation().openCommitDialog?.({
      workspaceRoot: "/ws",
      repoId: "explicit-repo",
    });

    expect(resolveRepoIdForResource).not.toHaveBeenCalled();
    expect(openGitCommitPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "explicit-repo",
      workspaceRoot: "/ws",
    });
  });

  it("resolves the repoId from the workspace root when omitted", async () => {
    await presentation().openCommitDialog?.({ workspaceRoot: "/ws" });

    expect(resolveRepoIdForResource).toHaveBeenCalledWith(gitView, "/ws", ".");
    expect(openGitCommitPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
    });
  });

  it("never opens the panel dialog, which cannot carry a repoId", async () => {
    await presentation().openCommitDialog?.({ workspaceRoot: "/ws" });

    expect(openGitWorkspaceDialog).not.toHaveBeenCalled();
  });

  it("reports and gives up when no repository can be resolved", async () => {
    resolveRepoIdForResource.mockResolvedValueOnce(null);

    await presentation().openCommitDialog?.({ workspaceRoot: "/ws" });

    expect(vscodeWindow.showErrorMessage).toHaveBeenCalledOnce();
    expect(openGitCommitPanel).not.toHaveBeenCalled();
  });
});

// Same reasons as Commit: `openPanelDialog` cannot carry a repoId, and the
// bottom panel's ~258px height leaves the branch list cramped.
describe("createGitMenuPresentation.openBranchesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepoIdForResource.mockResolvedValue("resolved-repo");
    resetBranchSurfaces();
  });

  it("uses the supplied repoId without resolving", async () => {
    await presentation().openBranchesDialog?.({
      workspaceRoot: "/ws",
      repoId: "explicit-repo",
    });

    expect(resolveRepoIdForResource).not.toHaveBeenCalled();
    expect(openGitBranchesPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "explicit-repo",
      workspaceRoot: "/ws",
    });
  });

  it("resolves the repoId from the workspace root when omitted", async () => {
    await presentation().openBranchesDialog?.({ workspaceRoot: "/ws" });

    expect(resolveRepoIdForResource).toHaveBeenCalledWith(gitView, "/ws", ".");
    expect(openGitBranchesPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
    });
  });

  it("never opens the panel dialog, which cannot carry a repoId", async () => {
    await presentation().openBranchesDialog?.({ workspaceRoot: "/ws" });

    expect(openGitWorkspaceDialog).not.toHaveBeenCalled();
  });

  it("reports and gives up when no repository can be resolved", async () => {
    resolveRepoIdForResource.mockResolvedValueOnce(null);

    await presentation().openBranchesDialog?.({ workspaceRoot: "/ws" });

    expect(vscodeWindow.showErrorMessage).toHaveBeenCalledOnce();
    expect(openGitBranchesPanel).not.toHaveBeenCalled();
  });
});

// New Branch / Branches prefer an already-open GitView editor tab as an
// overlay; only an acknowledged delivery suppresses the dedicated panel.
// Without a target (or an acknowledgement) the panel always opens —
// presentation means panel UX, never a silent native fallback.
describe("createGitMenuPresentation branch overlays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepoIdForResource.mockResolvedValue("resolved-repo");
    resetBranchSurfaces();
  });

  it("posts the createBranch overlay to the active tab instead of a new panel", async () => {
    const reveal = vi.fn();
    const deliver = vi.fn(async () => true);
    getGitViewOverlayTarget.mockReturnValue({ reveal, deliver });

    await presentation().openCreateBranchDialog?.({
      workspaceRoot: "/ws",
      repoId: "explicit-repo",
      startPoint: "main",
    });

    expect(getGitViewOverlayTarget).toHaveBeenCalledWith("explicit-repo");
    expect(reveal).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "git.openOverlay",
        payload: {
          surface: "createBranch",
          repoId: "explicit-repo",
          startPoint: "main",
        },
      }),
    );
    expect(openGitCreateBranchPanel).not.toHaveBeenCalled();
  });

  it("posts the branches overlay to the active tab instead of a new panel", async () => {
    const reveal = vi.fn();
    const deliver = vi.fn(async () => true);
    getGitViewOverlayTarget.mockReturnValue({ reveal, deliver });

    await presentation().openBranchesDialog?.({
      workspaceRoot: "/ws",
      repoId: "explicit-repo",
    });

    expect(getGitViewOverlayTarget).toHaveBeenCalledWith("explicit-repo");
    expect(reveal).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "git.openOverlay",
        payload: { surface: "branches", repoId: "explicit-repo" },
      }),
    );
    expect(openGitBranchesPanel).not.toHaveBeenCalled();
  });

  it("opens a panel when the overlay target does not acknowledge delivery", async () => {
    const reveal = vi.fn();
    getGitViewOverlayTarget.mockReturnValue({
      reveal,
      deliver: vi.fn(async () => false),
    });

    await presentation().openBranchesDialog?.({
      workspaceRoot: "/ws",
      repoId: "explicit-repo",
    });

    expect(reveal).toHaveBeenCalledOnce();
    expect(openGitBranchesPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "explicit-repo",
      workspaceRoot: "/ws",
    });
  });

  it("opens a panel when no overlay target exists, even with an active editor", async () => {
    vscodeWindow.activeTextEditor = { document: { uri: { fsPath: "/ws/a.ts" } } };

    await presentation().openCreateBranchDialog?.({ workspaceRoot: "/ws" });
    await presentation().openBranchesDialog?.({ workspaceRoot: "/ws" });

    expect(vscodeWindow.showInputBox).not.toHaveBeenCalled();
    expect(openGitCreateBranchPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
      startPoint: undefined,
    });
    expect(openGitBranchesPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
    });
  });

  it("opens a new panel when no tab can host the dialog", async () => {
    await presentation().openCreateBranchDialog?.({ workspaceRoot: "/ws" });
    await presentation().openBranchesDialog?.({ workspaceRoot: "/ws" });

    expect(openGitCreateBranchPanel).toHaveBeenCalledOnce();
    expect(openGitBranchesPanel).toHaveBeenCalledOnce();
  });

  it("prefers an explicit repoRoot when resolving the branches repository", async () => {
    await presentation().openBranchesDialog?.({
      workspaceRoot: "/ws",
      repoRoot: "/ws/nested",
    });

    expect(resolveRepoRoot).not.toHaveBeenCalled();
    expect(resolveRepoIdForResource).toHaveBeenCalledWith(
      gitView,
      "/ws/nested",
      ".",
    );
    expect(openGitBranchesPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
    });
  });

  it("prefers an explicit repoRoot when resolving the create-branch repository", async () => {
    await presentation().openCreateBranchDialog?.({
      workspaceRoot: "/ws",
      repoRoot: "/ws/nested",
    });

    expect(resolveRepoRoot).not.toHaveBeenCalled();
    expect(resolveRepoIdForResource).toHaveBeenCalledWith(
      gitView,
      "/ws/nested",
      ".",
    );
    expect(openGitCreateBranchPanel).toHaveBeenCalledWith(context, gitView, {
      repoId: "resolved-repo",
      workspaceRoot: "/ws",
    });
  });
});
