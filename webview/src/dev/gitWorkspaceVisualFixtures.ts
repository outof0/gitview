import {
  createHostError,
  createHostEvent,
  createHostResponse,
  isProtocolMessage,
  type HostToWebview,
} from "@gitview/shared/protocol";
import { createError } from "@gitview/shared/errors/codes";
import { DEFAULT_GIT_WORKSPACE_SETTINGS } from "@gitview/shared/types/gitWorkspaceSettings";
import type {
  Repository,
  RepositorySnapshot,
} from "@gitview/shared/types/repository";
import type { StatusSnapshot } from "@gitview/shared/types/status";
import type { SyncOperationEvent } from "@gitview/shared/types/sync";
import { useGitWorkspaceStore } from "../stores/gitWorkspaceStore";

const REPO_ID = "visual-repository";
const FIXED_TIME = 1_725_000_000_000;

export const GIT_WORKSPACE_VISUAL_STATE_IDS = [
  "loading",
  "no-repository",
  "repository-error",
  "clean",
  "changed",
  "untrusted",
  "unborn-no-remote",
  "detached",
  "no-remote",
  "no-upstream",
  "protected",
  "merge-conflict",
  "sync-fetch-running",
  "sync-fetch-cancelling",
  "sync-fetch-offline",
  "sync-pull-conflicts",
  "sync-update-all-running",
] as const;

export type GitWorkspaceVisualStateId =
  (typeof GIT_WORKSPACE_VISUAL_STATE_IDS)[number];

type GitWorkspaceVisualFixture = {
  repositorySnapshot: RepositorySnapshot;
  statusSnapshot?: StatusSnapshot;
  syncOperation?: SyncOperationEvent;
  refreshError?: string;
};

function repository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: REPO_ID,
    rootPath: "/workspace/gitview",
    workspaceFolderPath: "/workspace/gitview",
    gitDirPath: "/workspace/gitview/.git",
    name: "gitview",
    currentBranch: "main",
    headSha: "9c82b7d5f4a3e2109876543210abcdef12345678",
    upstream: "origin/main",
    isDetached: false,
    isBare: false,
    isWorktree: false,
    operation: { type: "none" },
    ahead: 2,
    behind: 1,
    conflictCount: 0,
    changeDigest: null,
    dirty: false,
    trusted: true,
    protectedBranch: false,
    lastRefreshAt: FIXED_TIME,
    headState: {
      kind: "attached",
      branch: "main",
      sha: "9c82b7d5f4a3e2109876543210abcdef12345678",
    },
    remoteState: {
      kind: "available",
      remotes: ["origin"],
      upstream: "origin/main",
    },
    ...overrides,
  };
}

function snapshot(repo: Repository | null): RepositorySnapshot {
  return {
    repositories: repo ? [repo] : [],
    activeRepoId: repo?.id ?? null,
    multiRootDiverged: false,
  };
}

function status(files: StatusSnapshot["files"] = []): StatusSnapshot {
  return {
    repoId: REPO_ID,
    files,
    changelists: [],
    mode: "staging",
    showIgnored: false,
    showUnversioned: true,
    refreshedAt: FIXED_TIME,
  };
}

function fetchOperation(
  overrides: Partial<SyncOperationEvent>,
): SyncOperationEvent {
  return {
    operationId: "sync-visual-1",
    requestId: "fetch-visual-1",
    operation: "fetch",
    repoIds: [REPO_ID],
    sequence: 2,
    timestamp: FIXED_TIME,
    state: "running",
    phase: "fetching",
    cancellable: true,
    progress: {
      completed: 0,
      total: 1,
      roots: [
        {
          repoId: REPO_ID,
          name: "gitview",
          state: "running",
          phase: "fetching",
        },
      ],
    },
    ...overrides,
  } as SyncOperationEvent;
}

const cleanRepository = repository();
const changedRepository = repository({ dirty: true });
const secondaryRepository = repository({
  id: "visual-repository-two",
  rootPath: "/workspace/shared-library",
  workspaceFolderPath: "/workspace/shared-library",
  gitDirPath: "/workspace/shared-library/.git",
  name: "shared-library",
  headSha: "187fde4a30192f7c9dd7f8cc6f62126f7527e0af",
  headState: {
    kind: "attached",
    branch: "main",
    sha: "187fde4a30192f7c9dd7f8cc6f62126f7527e0af",
  },
});
const multiRootSnapshot: RepositorySnapshot = {
  repositories: [cleanRepository, secondaryRepository],
  activeRepoId: cleanRepository.id,
  multiRootDiverged: false,
};

const fixtures: Record<
  Exclude<GitWorkspaceVisualStateId, "loading">,
  GitWorkspaceVisualFixture
> = {
  "no-repository": {
    repositorySnapshot: snapshot(null),
  },
  "repository-error": {
    repositorySnapshot: snapshot(null),
    refreshError:
      "Git executable could not be started. Check the configured Git path.",
  },
  clean: {
    repositorySnapshot: snapshot(cleanRepository),
    statusSnapshot: status(),
  },
  changed: {
    repositorySnapshot: snapshot(changedRepository),
    statusSnapshot: status([
      {
        repoId: REPO_ID,
        path: "src/services/repositoryService.ts",
        kind: "modified",
        indexStatus: " ",
        workingTreeStatus: "M",
        staged: false,
        conflicted: false,
        binary: false,
      },
      {
        repoId: REPO_ID,
        path: "webview/src/apps/gitWorkspace/GitWorkspaceShell.tsx",
        kind: "modified",
        indexStatus: "M",
        workingTreeStatus: " ",
        staged: true,
        conflicted: false,
        binary: false,
      },
      {
        repoId: REPO_ID,
        path: "src/shared/types/repositoryShell.ts",
        kind: "unversioned",
        indexStatus: "?",
        workingTreeStatus: "?",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ]),
  },
  untrusted: {
    repositorySnapshot: snapshot(repository({ trusted: false })),
  },
  "unborn-no-remote": {
    repositorySnapshot: snapshot(
      repository({
        headSha: null,
        upstream: null,
        ahead: null,
        behind: null,
        dirty: true,
        headState: { kind: "unborn", branch: "main" },
        remoteState: { kind: "none" },
      }),
    ),
    statusSnapshot: status([
      {
        repoId: REPO_ID,
        path: "README.md",
        kind: "unversioned",
        indexStatus: "?",
        workingTreeStatus: "?",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ]),
  },
  detached: {
    repositorySnapshot: snapshot(
      repository({
        currentBranch: null,
        upstream: null,
        isDetached: true,
        ahead: null,
        behind: null,
        headState: {
          kind: "detached",
          sha: "9c82b7d5f4a3e2109876543210abcdef12345678",
        },
        remoteState: {
          kind: "available",
          remotes: ["origin"],
          upstream: null,
        },
      }),
    ),
    statusSnapshot: status(),
  },
  "no-remote": {
    repositorySnapshot: snapshot(
      repository({
        upstream: null,
        ahead: null,
        behind: null,
        remoteState: { kind: "none" },
      }),
    ),
    statusSnapshot: status(),
  },
  "no-upstream": {
    repositorySnapshot: snapshot(
      repository({
        upstream: null,
        ahead: null,
        behind: null,
        remoteState: {
          kind: "available",
          remotes: ["company"],
          upstream: null,
        },
      }),
    ),
    statusSnapshot: status(),
  },
  protected: {
    repositorySnapshot: snapshot(repository({ protectedBranch: true })),
    statusSnapshot: status(),
  },
  "merge-conflict": {
    repositorySnapshot: snapshot(
      repository({
        dirty: true,
        conflictCount: 2,
        changeDigest: null,
        operation: { type: "merge", canContinue: false, canAbort: true },
      }),
    ),
    statusSnapshot: status([
      {
        repoId: REPO_ID,
        path: "src/config.ts",
        kind: "conflicted",
        indexStatus: "U",
        workingTreeStatus: "U",
        staged: false,
        conflicted: true,
        binary: false,
      },
      {
        repoId: REPO_ID,
        path: "src/router.ts",
        kind: "conflicted",
        indexStatus: "A",
        workingTreeStatus: "A",
        staged: false,
        conflicted: true,
        binary: false,
      },
    ]),
  },
  "sync-fetch-running": {
    repositorySnapshot: snapshot(cleanRepository),
    statusSnapshot: status(),
    syncOperation: fetchOperation({}),
  },
  "sync-fetch-cancelling": {
    repositorySnapshot: snapshot(cleanRepository),
    statusSnapshot: status(),
    syncOperation: fetchOperation({
      sequence: 3,
      state: "cancel_requested",
      phase: "fetching",
    }),
  },
  "sync-fetch-offline": {
    repositorySnapshot: snapshot(cleanRepository),
    statusSnapshot: status(),
    syncOperation: fetchOperation({
      sequence: 3,
      state: "failed",
      outcome: {
        kind: "offline",
        message:
          "The network is offline. Check your connection and retry fetch.",
      },
      progress: {
        completed: 1,
        total: 1,
        roots: [
          {
            repoId: REPO_ID,
            name: "gitview",
            state: "failed",
            outcome: {
              kind: "offline",
              message:
                "The network is offline. Check your connection and retry fetch.",
            },
          },
        ],
      },
    }),
  },
  "sync-pull-conflicts": {
    repositorySnapshot: snapshot(
      repository({
        dirty: true,
        conflictCount: 1,
        changeDigest: null,
        operation: { type: "merge", canContinue: false, canAbort: true },
      }),
    ),
    statusSnapshot: status([
      {
        repoId: REPO_ID,
        path: "src/router.ts",
        kind: "conflicted",
        indexStatus: "U",
        workingTreeStatus: "U",
        staged: false,
        conflicted: true,
        binary: false,
      },
    ]),
    syncOperation: fetchOperation({
      requestId: "pull-visual-1",
      operation: "pull",
      sequence: 4,
      state: "failed",
      outcome: {
        kind: "conflicts",
        message: "Pull stopped because files need conflict resolution.",
        paths: ["src/router.ts"],
      },
      progress: {
        completed: 1,
        total: 1,
        roots: [
          {
            repoId: REPO_ID,
            name: "gitview",
            state: "failed",
            outcome: {
              kind: "conflicts",
              message: "Pull stopped because files need conflict resolution.",
              paths: ["src/router.ts"],
            },
          },
        ],
      },
    }),
  },
  "sync-update-all-running": {
    repositorySnapshot: multiRootSnapshot,
    statusSnapshot: status(),
    syncOperation: {
      operationId: "sync-update-visual-1",
      requestId: "update-visual-1",
      operation: "update_all_roots",
      repoIds: [cleanRepository.id, secondaryRepository.id],
      sequence: 5,
      timestamp: FIXED_TIME,
      state: "running",
      phase: "pulling",
      cancellable: true,
      progress: {
        completed: 1,
        total: 2,
        roots: [
          {
            repoId: cleanRepository.id,
            name: cleanRepository.name,
            state: "succeeded",
            outcome: { kind: "success" },
          },
          {
            repoId: secondaryRepository.id,
            name: secondaryRepository.name,
            state: "running",
            phase: "pulling",
          },
        ],
      },
    },
  },
};

export function isGitWorkspaceVisualStateId(
  value: string | null,
): value is GitWorkspaceVisualStateId {
  return GIT_WORKSPACE_VISUAL_STATE_IDS.includes(
    value as GitWorkspaceVisualStateId,
  );
}

export function installGitWorkspaceVisualHost(
  stateId: GitWorkspaceVisualStateId,
): void {
  useGitWorkspaceStore.setState({ workspaceTab: "log" });
  const dispatch = (message: HostToWebview) => window.postMessage(message, "*");
  let acquired = false;

  window.acquireVsCodeApi = () => {
    if (acquired) {
      throw new Error("acquireVsCodeApi can only be called once");
    }
    acquired = true;
    return {
      postMessage: (raw: unknown) => {
        if (!isProtocolMessage(raw)) {
          return;
        }
        const message = raw as Record<string, unknown>;
        const requestId = String(message.requestId ?? "");
        if (message.type === "webview.ready") {
          dispatch(
            createHostResponse(requestId, "webview.ready", {
              surface: "gitWorkspace",
              settings: DEFAULT_GIT_WORKSPACE_SETTINGS,
            }),
          );
          return;
        }
        if (message.type !== "repo.refresh" || stateId === "loading") {
          return;
        }

        const fixture = fixtures[stateId];
        dispatch(createHostEvent("repo.snapshot", fixture.repositorySnapshot));
        if (fixture.statusSnapshot) {
          dispatch(createHostEvent("status.snapshot", fixture.statusSnapshot));
        }
        if (fixture.syncOperation) {
          dispatch(createHostEvent("sync.operation", fixture.syncOperation));
        }
        if (fixture.refreshError) {
          dispatch(
            createHostError(
              requestId,
              createError("GIT_COMMAND_FAILED", fixture.refreshError),
            ),
          );
          return;
        }
        dispatch(
          createHostResponse(requestId, "repo.refresh", { refreshed: true }),
        );
      },
      getState: () => null,
      setState: () => {},
    };
  };
}

declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
  }
}
