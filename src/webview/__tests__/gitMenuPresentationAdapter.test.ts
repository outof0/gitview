import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  openGitHistoryPanel,
  openGitViewPanel,
  openGitViewBlamePanel,
  openGitWorkspaceDialog,
  openGitCreateBranchPanel,
  openGitCommitPanel,
  openGitBranchesPanel,
  resolveRepoIdForResource,
  showErrorMessage,
} = vi.hoisted(() => ({
  openGitHistoryPanel: vi.fn(async () => undefined),
  openGitViewPanel: vi.fn(async () => undefined),
  openGitViewBlamePanel: vi.fn(async () => undefined),
  openGitWorkspaceDialog: vi.fn(async () => undefined),
  openGitCreateBranchPanel: vi.fn(async () => undefined),
  openGitCommitPanel: vi.fn(async () => undefined),
  openGitBranchesPanel: vi.fn(async () => undefined),
  resolveRepoIdForResource: vi.fn(async () => "resolved-repo" as string | null),
  showErrorMessage: vi.fn(async () => undefined),
}));

vi.mock("vscode", () => ({
  window: { showErrorMessage },
}));

vi.mock("../GitHistoryWebviewPanel", () => ({ openGitHistoryPanel }));
vi.mock("../gitViewPresentation", () => ({
  openGitViewPanel,
  openGitViewBlamePanel,
}));
vi.mock("../gitWorkspacePanel", () => ({ openGitWorkspaceDialog }));
vi.mock("../gitCreateBranchPanel", () => ({ openGitCreateBranchPanel }));
vi.mock("../gitCommitPanel", () => ({ openGitCommitPanel }));
vi.mock("../gitBranchesPanel", () => ({ openGitBranchesPanel }));
vi.mock("../gitViewPanelRouter", () => ({ resolveRepoIdForResource }));

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

describe("createGitMenuPresentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepoIdForResource.mockResolvedValue("resolved-repo");
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

    expect(showErrorMessage).toHaveBeenCalledOnce();
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

    expect(showErrorMessage).toHaveBeenCalledOnce();
    expect(openGitCommitPanel).not.toHaveBeenCalled();
  });
});

// Same reasons as Commit: `openPanelDialog` cannot carry a repoId, and the
// bottom panel's ~258px height leaves the branch list cramped.
describe("createGitMenuPresentation.openBranchesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepoIdForResource.mockResolvedValue("resolved-repo");
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

    expect(showErrorMessage).toHaveBeenCalledOnce();
    expect(openGitBranchesPanel).not.toHaveBeenCalled();
  });
});
