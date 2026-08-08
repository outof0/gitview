import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import { DEFAULT_GITVIEW_SETTINGS } from "../../types/settings";
import type { GitViewContext } from "../../activation";

const postMessage = vi.fn();
let configChangeHandler:
  | ((e: { affectsConfiguration: (section: string) => boolean }) => void)
  | undefined;

const readSettings = vi.fn(() => ({
  ...DEFAULT_GITVIEW_SETTINGS,
  showBasePanel: true,
  mergeEngine: "markers" as const,
}));

vi.mock("vscode", () => ({
  window: {
    activeTextEditor: undefined,
    createWebviewPanel: vi.fn(() => ({
      webview: {
        onDidReceiveMessage: vi.fn(),
        html: "",
        postMessage,
        cspSource: "vscode-webview://test",
        asWebviewUri: (u: { toString: () => string }) => u,
      },
      onDidDispose: vi.fn((cb: () => void) => {
        disposeCallback = cb;
      }),
      reveal: vi.fn(),
      viewType: "gitView",
      dispose: vi.fn(),
    })),
  },
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: "/ws" } },
      { uri: { fsPath: "/ws-second" } },
    ],
    getWorkspaceFolder: vi.fn((uri: { fsPath: string }) => {
      if (uri.fsPath.startsWith("/ws-second/")) {
        return { uri: { fsPath: "/ws-second" } };
      }
      if (uri.fsPath.startsWith("/ws/")) {
        return { uri: { fsPath: "/ws" } };
      }
      return undefined;
    }),
    onDidChangeConfiguration: vi.fn(
      (
        handler: (e: { affectsConfiguration: (s: string) => boolean }) => void,
      ) => {
        configChangeHandler = handler;
        return { dispose: vi.fn() };
      },
    ),
    isTrusted: true,
  },
  commands: {
    executeCommand: vi.fn(() => Promise.resolve()),
  },
  Uri: {
    joinPath: (...parts: string[]) => ({ path: parts.join("/") }),
  },
  ViewColumn: { Active: 1 },
  version: "1.90.0",
}));

let disposeCallback: (() => void) | undefined;

vi.mock("../getWebviewHtml", () => ({
  getWebviewHtml: vi.fn(() =>
    Promise.resolve('<html>window.__GITVIEW_APP__="merge"</html>'),
  ),
}));

vi.mock("../../services/fileService", () => ({
  createFileService: () => ({}),
}));

vi.mock("../../services/git/repo", () => ({
  createRepoApi: () => ({
    findRepoRoot: vi.fn((startPath: string) => {
      if (startPath.startsWith("/ws/nested")) {
        return Promise.resolve("/ws/nested");
      }
      if (startPath.startsWith("/ws-second")) {
        return Promise.resolve("/ws-second");
      }
      if (startPath.startsWith("/ws")) {
        return Promise.resolve("/ws");
      }
      return Promise.resolve(null);
    }),
    getBranchInfo: vi.fn(() =>
      Promise.resolve({ currentBranch: "main", mergeHead: "feature" }),
    ),
  }),
}));

vi.mock("../../services/git/merge", () => ({
  createMergeApi: () => ({
    listUnmergedFiles: vi.fn(() => Promise.resolve([])),
    readStage: vi.fn(() => Promise.resolve(null)),
  }),
}));

vi.mock("../../webviewHost/messageRouter", () => ({
  createMessageRouter: () => ({
    handleRawMessage: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock("../gitViewPanelRouter", () => ({
  resolveRepoIdForResource: vi.fn(() => Promise.resolve("repo-1")),
}));

vi.mock("../../commands/gitMenuActions", () => ({
  runGitMenuAction: vi.fn(),
}));

vi.mock("../GitHistoryWebviewPanel", () => ({
  openGitHistoryPanel: vi.fn(),
}));

vi.mock("../../config/readGitViewSettings", () => ({
  readGitViewSettings: () => readSettings(),
  themeKindFromVscode: () => "dark",
}));

import { createOrReveal } from "../GitViewPanel";

function makeGitView(): GitViewContext {
  return {
    gitService: { execGit: vi.fn() },
    repositoryService: {
      discoverRepositories: vi.fn(() => Promise.resolve([])),
      resolveRepositoryForResource: vi.fn(),
      buildSnapshot: vi.fn(),
    },
    protectionService: {} as GitViewContext["protectionService"],
    refreshCoordinator: {
      refreshNow: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    } as unknown as GitViewContext["refreshCoordinator"],
    changelistStorage: {} as GitViewContext["changelistStorage"],
    shelfStorage: {} as GitViewContext["shelfStorage"],
    branchFavoriteStorage: {} as GitViewContext["branchFavoriteStorage"],
    commitCheckService: {} as GitViewContext["commitCheckService"],
    dispose: vi.fn(),
  } as unknown as GitViewContext;
}

describe("GitViewPanel configuration wiring", () => {
  const context = {
    extensionUri: { path: "/ext" },
    subscriptions: [] as { dispose: () => void }[],
    extension: { packageJSON: { version: "0.0.1" } },
    secrets: { get: vi.fn(), store: vi.fn() },
  } as unknown as import("vscode").ExtensionContext;

  const gitView = makeGitView();

  beforeEach(async () => {
    vi.clearAllMocks();
    postMessage.mockClear();
    disposeCallback?.();
    disposeCallback = undefined;
    configChangeHandler = undefined;
    readSettings.mockReturnValue({
      ...DEFAULT_GITVIEW_SETTINGS,
      showBasePanel: true,
      mergeEngine: "markers",
    });
    await createOrReveal(context, gitView);
  });

  it("posts merge.settings when gitView configuration changes", async () => {
    expect(configChangeHandler).toBeDefined();

    configChangeHandler!({
      affectsConfiguration: (section) => section === "gitView",
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "merge.settings",
        payload: expect.objectContaining({
          showBasePanel: true,
          mergeEngine: "markers",
        }),
      }),
    );
  });

  it("ignores unrelated configuration sections", async () => {
    postMessage.mockClear();

    configChangeHandler!({
      affectsConfiguration: (section) => section === "editor.fontSize",
    });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does not post settings when the panel has been disposed", async () => {
    disposeCallback?.();
    postMessage.mockClear();

    configChangeHandler!({
      affectsConfiguration: (section) => section === "gitView",
    });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does not duplicate config updates after close and reopen", async () => {
    disposeCallback?.();
    postMessage.mockClear();

    await createOrReveal(context, gitView);

    configChangeHandler!({
      affectsConfiguration: (section) => section === "gitView",
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("recreates the resolver panel when opened for another workspace", async () => {
    await createOrReveal(context, gitView, {
      fsPath: "/ws-second/src/app.ts",
      scheme: "file",
    } as vscode.Uri);

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it("uses the resource repository root for nested repositories", async () => {
    await createOrReveal(context, gitView, {
      fsPath: "/ws/nested/src/app.ts",
      scheme: "file",
    } as vscode.Uri);

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it("Resolve conflict (openConflictFile false) re-reveal posts conflict list, not merge.openFile", async () => {
    postMessage.mockClear();
    await createOrReveal(
      context,
      gitView,
      { fsPath: "/ws/file.txt", scheme: "file" } as vscode.Uri,
      { openConflictFile: false },
    );

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "merge.showConflictList" }),
    );
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "merge.openFile",
      }),
    );
  });
});