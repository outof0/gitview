import {
  PROTOCOL_VERSION,
  createHostEvent,
  createHostResponse,
  isProtocolMessage,
  type HostToWebview,
} from "@gitview/shared/protocol";
import { DEFAULT_GIT_WORKSPACE_SETTINGS } from "@gitview/shared/types/gitWorkspaceSettings";
import {
  DEFAULT_GITVIEW_SETTINGS,
  type GitViewSettings,
} from "@gitview/types";
import {
  createPlaygroundFixtures,
  type PlaygroundFixtures,
  type PlaygroundScenario,
  scenarioDocument,
  scenarioRelativePath,
} from "./fixtures";

const PLAYGROUND_REPO_ID = "playground-repo";

export type PostedMessage = Record<string, unknown>;

export type MockHost = {
  handleMessage: (msg: Record<string, unknown>) => void;
  getPosted: () => PostedMessage[];
  clearPosted: () => void;
  pushSettings: (partial: Partial<GitViewSettings>) => void;
  loadScenario: (scenario: PlaygroundScenario) => void;
  getSettings: () => GitViewSettings;
};

export type MockHostOptions = {
  dispatch?: (msg: HostToWebview) => void;
};

export function createMockHost(
  initialFixtures: PlaygroundFixtures = createPlaygroundFixtures(),
  options?: MockHostOptions,
): MockHost {
  const dispatch =
    options?.dispatch ??
    ((msg: HostToWebview) => window.postMessage(msg, "*"));
  let fixtures = initialFixtures;
  let settings: GitViewSettings = {
    ...DEFAULT_GITVIEW_SETTINGS,
    ...fixtures.settings,
  };
  const posted: PostedMessage[] = [];

  function sendMergeInit(): void {
    dispatch(
      createHostEvent("merge.init", {
        repoId: PLAYGROUND_REPO_ID,
        themeKind: "dark" as const,
        extensionVersion: "playground",
        settings,
      }),
    );
  }

  function sendConflictsList(): void {
    dispatch(
      createHostEvent("conflict.snapshot", {
        repoRoot: fixtures.repoRoot,
        files: fixtures.conflictFiles.map((f) => ({
          relativePath: f.relativePath,
          stageCode: f.stageCode,
        })),
        branchInfo: fixtures.branchInfo,
      }),
    );
  }

  function openDocument(relativePath: string): void {
    const doc =
      fixtures.documents[relativePath] ??
      scenarioDocument(fixtures, "simpleMerge");
    if (!doc) {
      return;
    }
    dispatch(createHostEvent("merge.document", doc));
  }

  function sendHistoryBootstrap(path = "src/app.ts"): void {
    dispatch({
      protocolVersion: PROTOCOL_VERSION,
      type: "history.init",
      payload: {
        path,
        isFolder: false,
        repoId: PLAYGROUND_REPO_ID,
        branches: ["main", fixtures.branchInfo.currentBranch],
        currentBranch: fixtures.branchInfo.currentBranch ?? "main",
      },
    });
    dispatch({
      protocolVersion: PROTOCOL_VERSION,
      type: "log.snapshot",
      payload: {
        repoId: PLAYGROUND_REPO_ID,
        branch: fixtures.branchInfo.currentBranch ?? "main",
        commits: fixtures.fileLog,
        refreshedAt: Date.now(),
        filters: { path },
      },
    });
  }

  const host: MockHost = {
    getPosted: () => [...posted],
    clearPosted: () => {
      posted.length = 0;
    },
    getSettings: () => ({ ...settings }),
    pushSettings: (partial) => {
      settings = { ...settings, ...partial };
      dispatch(createHostEvent("merge.settings", settings));
    },
    loadScenario: (scenario) => {
      if (scenario === "conflictList") {
        sendConflictsList();
        return;
      }
      const path = scenarioRelativePath(scenario);
      if (scenario === "markersMerge") {
        host.pushSettings({ mergeEngine: "markers" });
      } else {
        host.pushSettings({ mergeEngine: "threeWay" });
      }
      openDocument(path);
    },
    handleMessage: (msg) => {
      posted.push(msg);
      const requestId = String(msg.requestId ?? "");
      switch (msg.type) {
        case "webview.ready": {
          const surface = (msg.payload as { surface?: string } | undefined)
            ?.surface;
          if (surface === "merge") {
            dispatch(
              createHostResponse(requestId, "webview.ready", {
                surface: "merge",
                settings: DEFAULT_GIT_WORKSPACE_SETTINGS,
              }),
            );
            sendMergeInit();
            sendConflictsList();
            break;
          }
          dispatch(
            createHostResponse(requestId, "webview.ready", {
              surface: surface ?? "gitHistory",
              settings: DEFAULT_GIT_WORKSPACE_SETTINGS,
            }),
          );
          sendHistoryBootstrap();
          break;
        }
        case "conflict.refresh":
          sendConflictsList();
          dispatch(
            createHostResponse(requestId, "conflict.refresh", {
              refreshed: true,
            }),
          );
          break;
        case "merge.openFile": {
          const path = (msg.payload as { path?: string }).path ?? "src/app.ts";
          openDocument(path);
          dispatch(
            createHostResponse(requestId, "merge.openFile", { path }),
          );
          break;
        }
        case "merge.markResolved": {
          const path =
            (msg.payload as { path?: string }).path ?? "src/app.ts";
          dispatch(
            createHostResponse(requestId, "merge.resolved", { path }),
          );
          break;
        }
        case "merge.save": {
          const path =
            (msg.payload as { path?: string }).path ?? "src/app.ts";
          dispatch(
            createHostResponse(requestId, "merge.saved", {
              path,
              hint: "Saved.",
            }),
          );
          break;
        }
        case "blame.query": {
          const payload = msg.payload as { path?: string };
          dispatch({
            protocolVersion: PROTOCOL_VERSION,
            type: "blame.snapshot",
            payload: {
              repoId: PLAYGROUND_REPO_ID,
              filePath: payload.path ?? "src/app.ts",
              ref: "HEAD",
              lines: [
                {
                  lineNumber: 4,
                  sha: "abc1234567890abcdef1234567890abcdef12345",
                  shortSha: "abc1234",
                  author: "Jane Doe",
                  authorEmail: "jane@example.com",
                  authorTime: 1_719_000_000,
                  summary: "Fix greeting",
                },
              ],
              refreshedAt: Date.now(),
            },
          });
          dispatch(
            createHostResponse(requestId, "blame.query", {
              repoId: PLAYGROUND_REPO_ID,
              filePath: payload.path ?? "src/app.ts",
              ref: "HEAD",
              lines: [],
              refreshedAt: Date.now(),
            }),
          );
          break;
        }
        case "log.changesFromSide":
          dispatch(
            createHostResponse(requestId, "log.changesFromSide", {
              side: (msg.payload as { side?: "ours" | "theirs" }).side ?? "ours",
              relativePath: (msg.payload as { relativePath?: string })
                .relativePath,
              mergeBase: fixtures.changesFromSide.commits[0]?.sha ?? "base",
              revisionRange: fixtures.changesFromSide.revisionRange,
              branchRef: "HEAD",
              commits: fixtures.changesFromSide.commits,
              allChangedPaths: ["src/app.ts"],
            }),
          );
          break;
        case "log.query": {
          const query = (msg.payload ?? {}) as {
            path?: string;
            branch?: string;
          };
          const snapshot = {
            repoId: PLAYGROUND_REPO_ID,
            branch: query.branch ?? fixtures.branchInfo.currentBranch ?? "main",
            commits: fixtures.fileLog,
            refreshedAt: Date.now(),
            filters: query,
          };
          dispatch({
            protocolVersion: PROTOCOL_VERSION,
            type: "log.snapshot",
            payload: snapshot,
          });
          dispatch(createHostResponse(requestId, "log.query", snapshot));
          break;
        }
        case "log.fileAtRevision": {
          const payload = (msg.payload ?? {}) as { sha?: string; path?: string };
          dispatch(
            createHostResponse(requestId, "log.fileAtRevision", {
              sha: payload.sha ?? "",
              path: payload.path ?? "",
              text: "playground revision\n",
            }),
          );
          break;
        }
        default:
          break;
      }
    },
  };

  return host;
}

export function installPlaygroundVsCodeApi(host: MockHost): void {
  let acquired = false;
  window.acquireVsCodeApi = () => {
    if (acquired) {
      throw new Error("acquireVsCodeApi can only be called once");
    }
    acquired = true;
    return {
      postMessage: (msg: unknown) => {
        if (isProtocolMessage(msg)) {
          host.handleMessage(msg as Record<string, unknown>);
        }
      },
      getState: () => null,
      setState: () => {},
    };
  };
}

declare function acquireVsCodeApi(): {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

declare global {
  interface Window {
    __gitviewPlayground?: MockHost;
    acquireVsCodeApi: typeof acquireVsCodeApi;
  }
}