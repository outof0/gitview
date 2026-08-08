import { beforeEach, vi } from "vitest";
import * as vscode from "vscode";
import type { GitMenuPresentation } from "../gitMenuPresentation";

const gitMenuTestMocks = vi.hoisted(() => {
  const execFile = vi.fn();
  const execFilePromise = vi.fn();
  Object.assign(execFile, {
    [Symbol.for("nodejs.util.promisify.custom")]: execFilePromise,
  });
  return {
    mockExecFile: execFile,
    mockExecFilePromise: execFilePromise,
    mockFindRepoRoot: vi.fn(),
    mockLogFile: vi.fn(),
    mockListBranches: vi.fn(),
    mockBlameFile: vi.fn(),
    mockResolveGitRepository: vi.fn(),
    mockShelveChanges: vi.fn(),
    mockUnshelveLatest: vi.fn(),
    mockOpenGitHistoryPanel: vi.fn(),
    mockOpenGitViewPanel: vi.fn(),
    mockOpenGitViewBlamePanel: vi.fn(),
  };
});

vi.mock("child_process", () => ({
  execFile: gitMenuTestMocks.mockExecFile,
}));

vi.mock("vscode", () => ({
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    showTextDocument: vi.fn().mockResolvedValue({}),
    activeTextEditor: undefined,
    visibleTextEditors: [],
  },
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: "/repo" } },
      { uri: { fsPath: "/repo-b" } },
    ],
    fs: {
      stat: vi.fn(async () => ({})),
    },
    getWorkspaceFolder: vi.fn((uri: { fsPath: string }) => {
      if (uri.fsPath === "/repo-b" || uri.fsPath.startsWith("/repo-b/")) {
        return { uri: { fsPath: "/repo-b" } };
      }
      if (uri.fsPath === "/repo" || uri.fsPath.startsWith("/repo/")) {
        return { uri: { fsPath: "/repo" } };
      }
      return undefined;
    }),
    asRelativePath: vi.fn((uri: { fsPath: string }) => {
      if (uri.fsPath.startsWith("/repo-b/")) {
        return uri.fsPath.replace(/^\/repo-b\//, "");
      }
      return uri.fsPath.replace(/^\/repo\//, "");
    }),
  },
  env: {
    clipboard: { writeText: vi.fn() },
  },
  commands: {
    executeCommand: vi.fn(),
  },
  FileType: {
    File: 1,
    Directory: 2,
  },
  QuickPickItemKind: {
    Separator: -1,
    Default: 0,
  },
  Uri: {
    file: (p: string) => ({ fsPath: p, scheme: "file" }),
    parse: (s: string) => ({ fsPath: s, scheme: "git", toString: () => s }),
  },
  extensions: {
    getExtension: vi.fn(),
    all: [],
  },
}));

vi.mock("../../services/gitService", () => ({
  createDefaultExecGit: () =>
    async (repoRoot: string, args: string[]) =>
      gitMenuTestMocks.mockExecFilePromise(
        "git",
        ["--no-pager", ...args],
        { cwd: repoRoot },
      ),
  createGitService: (deps?: {
    execGit?: (repoRoot: string, args: string[]) => Promise<{
      stdout: string;
      stderr: string;
    }>;
  }) => {
    const execGit =
      deps?.execGit ??
      (async (repoRoot: string, args: string[]) =>
        gitMenuTestMocks.mockExecFilePromise(
          "git",
          ["--no-pager", ...args],
          { cwd: repoRoot },
        ));
    return {
      execGit,
      findRepoRoot: gitMenuTestMocks.mockFindRepoRoot,
      logFile: gitMenuTestMocks.mockLogFile,
      listBranches: gitMenuTestMocks.mockListBranches,
      blameFile: gitMenuTestMocks.mockBlameFile,
      blameFileForAnnotate: gitMenuTestMocks.mockBlameFile,
      stageAll: (repoRoot: string) => execGit(repoRoot, ["add", "-A"]),
      stageFiles: (repoRoot: string, paths: string[]) =>
        execGit(repoRoot, ["add", "--", ...paths]),
      unstageAll: (repoRoot: string) => execGit(repoRoot, ["reset", "HEAD"]),
      unstageFiles: (repoRoot: string, paths: string[]) =>
        execGit(repoRoot, ["reset", "HEAD", "--", ...paths]),
      commit: async (
        repoRoot: string,
        input: { message: string; gpgSign?: boolean },
      ) => {
        const args = ["commit"];
        if (input.gpgSign) {
          args.push("-S");
        }
        args.push("-m", input.message);
        await execGit(repoRoot, args);
        return { sha: "abc1234" };
      },
      fetch: (repoRoot: string, remote = "origin") =>
        execGit(repoRoot, ["fetch", remote]),
      pull: (
        repoRoot: string,
        strategy: "merge" | "rebase" | "ff_only" = "merge",
        remote = "origin",
      ) =>
        execGit(repoRoot, [
          "pull",
          remote,
          strategy === "rebase"
            ? "--rebase"
            : strategy === "ff_only"
              ? "--ff-only"
              : "--no-rebase",
        ]),
      push: async (repoRoot: string) => {
        await execGit(repoRoot, ["push"]);
        return { rejected: false, stderr: "" };
      },
    };
  },
}));

vi.mock("../../util/vscodeGit", () => ({
  resolveGitRepository: gitMenuTestMocks.mockResolveGitRepository,
}));

vi.mock("../../util/gitShelves", () => ({
  shelveChanges: gitMenuTestMocks.mockShelveChanges,
  unshelveLatest: gitMenuTestMocks.mockUnshelveLatest,
}));

vi.mock("../../webview/GitHistoryWebviewPanel", () => ({
  openGitHistoryPanel: gitMenuTestMocks.mockOpenGitHistoryPanel,
}));

vi.mock("../../webview/gitViewPresentation", () => ({
  openGitViewPanel: gitMenuTestMocks.mockOpenGitViewPanel,
  openGitViewBlamePanel: gitMenuTestMocks.mockOpenGitViewBlamePanel,
}));

const mockDiffView = {
  layout: "split" as const,
  status: "M" as const,
  left: { label: "L", text: "a\n" },
  right: { label: "R", text: "b\n" },
};

vi.mock("../../util/gitDiffPreview", () => ({
  buildRefDiffView: vi.fn(async () => mockDiffView),
  buildWorkingTreeDiffView: vi.fn(async () => mockDiffView),
  buildParentCommitDiffView: vi.fn(async () => mockDiffView),
  buildRootCommitDiffView: vi.fn(async () => mockDiffView),
  diffPreviewTitle: (rel: string, left: string, right: string) =>
    `${rel} (${left} ↔ ${right})`,
}));

vi.mock("../showGitHistory", () => ({
  showGitHistory: vi.fn(),
}));

export function mockRepoRootForPath(startPath: string): string | null {
  if (startPath === "/repo-b" || startPath.startsWith("/repo-b/")) {
    return "/repo-b";
  }
  if (startPath === "/repo" || startPath.startsWith("/repo/")) {
    return "/repo";
  }
  return null;
}

export const context = {
  extensionUri: { fsPath: "/ext" },
} as vscode.ExtensionContext;

export const mockGitView = {
  gitService: { execGit: vi.fn() },
  repositoryService: {
    discoverRepositories: vi.fn(async () => []),
    resolveRepositoryForResource: vi.fn(() => null),
  },
  protectionService: { isProtectedBranch: vi.fn() },
  refreshCoordinator: { subscribe: vi.fn(), refreshNow: vi.fn() },
  changelistStorage: {},
  branchFavoriteStorage: {},
  shelfStorage: {},
  commitCheckService: {},
  gitMenuPresentation: {
    openHistory: vi.fn(async (
      request: Parameters<GitMenuPresentation["openHistory"]>[0],
    ) => {
      await gitMenuTestMocks.mockOpenGitHistoryPanel(
        context,
        mockGitView,
        request.relativePath,
        request.isFolder,
        request.workspaceRoot,
      );
    }),
    openDiff: vi.fn(async (
      request: Parameters<GitMenuPresentation["openDiff"]>[0],
    ) => {
      await gitMenuTestMocks.mockOpenGitViewPanel(
        context,
        request.preview,
        request.workspaceRoot,
        {
          reusePanel: request.reusePanel,
          openInActiveColumn: request.openInActiveColumn,
        },
      );
    }),
    openBlame: vi.fn(async (
      request: Parameters<GitMenuPresentation["openBlame"]>[0],
    ) => {
      await gitMenuTestMocks.mockOpenGitViewBlamePanel(
        context,
        mockGitView,
        {
          relativePath: request.relativePath,
          lines: [],
          loading: true,
        },
        request.workspaceRoot,
        request.repoRoot,
      );
    }),
  },
  dispose: vi.fn(),
} as unknown as import("../../activation").GitViewContext;

export const mockGitMenuPresentation =
  mockGitView.gitMenuPresentation as GitMenuPresentation;

export const {
  mockExecFile,
  mockExecFilePromise,
  mockFindRepoRoot,
  mockLogFile,
  mockListBranches,
  mockBlameFile,
  mockResolveGitRepository,
  mockShelveChanges,
  mockUnshelveLatest,
  mockOpenGitHistoryPanel,
  mockOpenGitViewPanel,
  mockOpenGitViewBlamePanel,
} = gitMenuTestMocks;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindRepoRoot.mockImplementation(async (startPath: string) =>
    mockRepoRootForPath(startPath),
  );
  mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });
  mockResolveGitRepository.mockImplementation(
    async (uri?: { fsPath: string }) => {
      if (uri?.fsPath.startsWith("/repo-b")) {
        return { rootUri: { fsPath: "/repo-b" } };
      }
      if (uri) {
        return { rootUri: { fsPath: "/repo" } };
      }
      return undefined;
    },
  );
  mockLogFile.mockResolvedValue({
    ok: true,
    commits: [
      {
        sha: "abc1234567890abcdef1234567890abcdef12345",
        shortSha: "abc1234",
        author: "Jane",
        authorEmail: "jane@example.com",
        authorTime: 1,
        subject: "Fix bug",
        changedFiles: [],
      },
    ],
  });
  mockListBranches.mockResolvedValue(["main", "feature"]);
});
