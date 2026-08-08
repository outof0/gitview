import { describe, it, expect, vi, beforeEach } from "vitest";

const { createWebviewPanel } = vi.hoisted(() => ({
  createWebviewPanel: vi.fn(() => ({
    webview: {
      onDidReceiveMessage: vi.fn(),
      html: 'window.__GITVIEW_APP__="gitHistory"',
      postMessage: vi.fn(),
      cspSource: "vscode-webview://test",
      asWebviewUri: (u: { toString: () => string }) => u,
    },
    onDidDispose: vi.fn(),
    reveal: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("vscode", () => ({
  window: { createWebviewPanel },
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: "/ws-first" } },
      { uri: { fsPath: "/ws-second" } },
    ],
    isTrusted: true,
  },
  Uri: {
    joinPath: (...parts: string[]) => ({ path: parts.join("/") }),
  },
  ViewColumn: { Active: 1, Beside: 2 },
}));

vi.mock("../getWebviewHtml", () => ({
  getWebviewHtml: vi.fn(() => Promise.resolve("<html></html>")),
}));

const { mockResolveRepoId } = vi.hoisted(() => ({
  mockResolveRepoId: vi.fn(async () => "repo-1"),
}));
vi.mock("../gitViewPanelRouter", () => ({
  resolveRepoIdForResource: mockResolveRepoId,
  buildHistoryInitPayload: vi.fn(),
  createGitViewPanelRouter: vi.fn(() => ({
    handleRawMessage: vi.fn(),
  })),
  postHistoryInit: vi.fn(),
}));

import { openGitHistoryPanel } from "../GitHistoryWebviewPanel";

function makeGitView() {
  return {
    gitService: { execGit: vi.fn() },
    repositoryService: {
      discoverRepositories: vi.fn(async () => [
        {
          id: "repo-1",
          rootPath: "/ws-second",
          workspaceFolderPath: "/ws-second",
          currentBranch: "main",
          trusted: true,
        },
      ]),
      resolveRepositoryForResource: vi.fn(() => ({
        id: "repo-1",
        rootPath: "/ws-second",
        workspaceFolderPath: "/ws-second",
        currentBranch: "main",
        trusted: true,
      })),
    },
    protectionService: { isProtectedBranch: vi.fn() },
    refreshCoordinator: { subscribe: vi.fn(), refreshNow: vi.fn() },
    changelistStorage: {},
    branchFavoriteStorage: {},
    shelfStorage: {},
    commitCheckService: {},
    dispose: vi.fn(),
  } as unknown as import("../../activation").GitViewContext;
}

describe("GitHistoryWebviewPanel workspace root", () => {
  const context = {
    extensionUri: { path: "/ext" },
    subscriptions: [] as { dispose: () => void }[],
  } as unknown as import("vscode").ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveRepoId.mockResolvedValue("repo-1");
  });

  it("resolves repoId for the selected workspace folder", async () => {
    const gitView = makeGitView();
    await openGitHistoryPanel(
      context,
      gitView,
      "src/app.ts",
      false,
      "/ws-second",
    );

    expect(mockResolveRepoId).toHaveBeenCalledWith(
      gitView,
      "/ws-second",
      "src/app.ts",
    );
    expect(createWebviewPanel).toHaveBeenCalledOnce();
  });

  it("creates separate panels for the same path in different workspace roots", async () => {
    const gitView = makeGitView();
    await openGitHistoryPanel(context, gitView, "src/app.ts", false, "/ws-a");
    await openGitHistoryPanel(context, gitView, "src/app.ts", false, "/ws-b");

    expect(createWebviewPanel).toHaveBeenCalledTimes(2);
  });
});