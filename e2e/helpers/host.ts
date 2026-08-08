import type { Page } from "@playwright/test";
import {
  createHostEvent,
  createHostError,
  createHostResponse,
  isProtocolMessage,
} from "../../src/shared/protocol";
import type { BlameLine, GitCommitEntry } from "../../src/types/blame";
import type { MergeDocument } from "../../src/core/types";
import {
  DEFAULT_GITVIEW_SETTINGS,
  type GitViewSettings,
} from "../../src/types/settings";
import {
  executeWebviewGitMenuAction,
  handleGitHistoryOpen,
  type GitMenuActionPayload,
} from "./git-actions";
import { createGitService } from "../../out/services/gitService";
import { peekGitEffect, resetGitEffect, setGitEffect } from "./git-effects";
import { fetchFileBlame } from "./git-actions";
import { openRealGitHistoryPage } from "./git-history-bootstrap";

const gitService = createGitService();
const E2E_REPO_ID = "e2e-repo";

export type ConflictFileFixture = {
  relativePath: string;
  stageCode: string;
};

export type HostErrorFixture = {
  code: string;
  message: string;
};

export type HostFixtures = {
  mergeDocument: MergeDocument;
  blameOurs: { lines: BlameLine[]; authorSample: string; shaSample: string };
  blameTheirs: { lines: BlameLine[]; authorSample: string; shaSample: string };
  fileLog: { commits: GitCommitEntry[]; subjectSample: string };
  changesFromSide: { commits: GitCommitEntry[]; revisionRange: string };
  /** Override conflict list shown in the dialog. */
  conflictFiles?: ConflictFileFixture[];
  /** Per-path merge documents when opening different files from the list. */
  mergeDocumentsByPath?: Record<string, MergeDocument>;
  /** Per-path errors instead of opening the resolver (E5/E11). */
  mergeOpenErrors?: Record<string, HostErrorFixture>;
  /** When set, merge.save replies with error (E6). */
  saveShouldFail?: boolean;
  saveFailMessage?: string;
  /** When set, merge.markResolved replies with error (E6). */
  resolveShouldFail?: boolean;
  resolveFailMessage?: string;
  /** Partial override of workspace settings pushed via merge.init / merge.settings. */
  settings?: Partial<GitViewSettings>;
};

export type PostedHostMessage = {
  type: string;
  payload?: Record<string, unknown>;
  protocolVersion?: number;
  requestId?: string;
};

/** Mutable fixtures for the current page's mock host (updated by setup/reopen). */
let routedFixtures: HostFixtures | null = null;

export function setRoutedFixtures(fixtures: HostFixtures): void {
  routedFixtures = fixtures;
}

function activeFixtures(fallback: HostFixtures): HostFixtures {
  return routedFixtures ?? fallback;
}

function resolveSettings(fixtures: HostFixtures): GitViewSettings {
  return { ...DEFAULT_GITVIEW_SETTINGS, ...fixtures.settings };
}

function defaultConflictFiles(
  fx: HostFixtures,
): ConflictFileFixture[] {
  return (
    fx.conflictFiles ?? [
      {
        relativePath: fx.mergeDocument.relativePath,
        stageCode: "UU",
      },
    ]
  );
}

function conflictSnapshotEvent(fx: HostFixtures, files: ConflictFileFixture[]) {
  return createHostEvent("conflict.snapshot", {
    repoRoot: fx.mergeDocument.repoRoot,
    files,
    branchInfo: {
      currentBranch: fx.mergeDocument.oursLabel,
      mergeHead: fx.mergeDocument.theirsLabel,
    },
  });
}

async function dispatchHostMessage(
  page: Page,
  message: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((m) => window.postMessage(m, "*"), message);
}

export type MockHostOptions = {
  /** When set, git.menuAction messages mutate this repository via real Git CLI. */
  realGitRepoRoot?: string;
  /** Navigate to the Git History app after history.openPanel (desktop-IDE-style History tab). */
  openHistoryPageOnRequest?: boolean;
};

/** Mock VS Code host: intercepts webview postMessage and replies like the extension. */
export async function installMockHost(
  page: Page,
  fixtures: HostFixtures,
  options: MockHostOptions = {},
): Promise<void> {
  const { realGitRepoRoot, openHistoryPageOnRequest = false } = options;
  resetGitEffect();
  setRoutedFixtures(fixtures);
  const posted: PostedHostMessage[] = [];
  let settingsState = resolveSettings(fixtures);
  let conflictFilesState = defaultConflictFiles(fixtures);

  await page.exposeFunction("__gitviewGetPosted", () => [...posted]);
  await page.exposeFunction("__gitviewClearPosted", () => {
    posted.length = 0;
  });
  await page.exposeFunction("__gitviewPeekGitEffect", () => peekGitEffect());
  await page.exposeFunction(
    "__gitviewPushSettings",
    async (partial: Partial<GitViewSettings>) => {
      settingsState = { ...settingsState, ...partial };
      await dispatchHostMessage(
        page,
        createHostEvent("merge.settings", settingsState),
      );
    },
  );

  await page.exposeFunction(
    "__gitviewRouteMessage",
    async (msg: Record<string, unknown>) => {
      posted.push(msg as PostedHostMessage);
      if (!isProtocolMessage(msg)) {
        return null;
      }

      const type = msg.type as string;
      const payload = (msg.payload ?? {}) as Record<string, unknown>;
      const requestId = String(msg.requestId ?? "");
      const fx = activeFixtures(fixtures);

      switch (type) {
        case "webview.ready": {
          settingsState = resolveSettings(fx);
          conflictFilesState = defaultConflictFiles(fx);
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "webview.ready", {
              surface: "merge",
              settings: DEFAULT_GITVIEW_SETTINGS,
            }),
          );
          await dispatchHostMessage(
            page,
            createHostEvent("merge.init", {
              repoId: E2E_REPO_ID,
              themeKind: "dark",
              extensionVersion: "e2e",
              settings: settingsState,
            }),
          );
          await dispatchHostMessage(
            page,
            conflictSnapshotEvent(fx, conflictFilesState),
          );
          break;
        }
        case "merge.confirmDiscard": {
          const action = payload.action as Record<string, unknown> | undefined;
          if (action) {
            await dispatchHostMessage(
              page,
              createHostResponse(requestId, "merge.confirmDiscard", action),
            );
          }
          break;
        }
        case "conflict.refresh":
          await dispatchHostMessage(
            page,
            conflictSnapshotEvent(fx, conflictFilesState),
          );
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "conflict.refresh", {
              refreshed: true,
            }),
          );
          break;
        case "conflict.applyNonConflicting":
          conflictFilesState = conflictFilesState.filter(
            (f) => f.stageCode === "UU" || f.stageCode === "AA",
          );
          await dispatchHostMessage(
            page,
            conflictSnapshotEvent(fx, conflictFilesState),
          );
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "conflict.applyNonConflicting", {
              applied: true,
            }),
          );
          break;
        case "merge.openFile": {
          const path = payload.path as string | undefined;
          const openError = path ? fx.mergeOpenErrors?.[path] : undefined;
          if (openError) {
            await dispatchHostMessage(
              page,
              createHostError(requestId, openError),
            );
            break;
          }
          const doc =
            (path && fx.mergeDocumentsByPath?.[path]) ?? fx.mergeDocument;
          await dispatchHostMessage(page, createHostEvent("merge.document", doc));
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "merge.openFile", { path: path ?? "" }),
          );
          break;
        }
        case "merge.save":
          if (fx.saveShouldFail) {
            await dispatchHostMessage(
              page,
              createHostError(requestId, {
                code: "SAVE_FAILED",
                message:
                  fx.saveFailMessage ??
                  "Failed to save: mock host simulated disk error.",
              }),
            );
            break;
          }
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "merge.saved", {
              path: payload.path as string,
              hint: "Saved. Use Apply to finish resolving this file.",
            }),
          );
          break;
        case "merge.markResolved": {
          if (fx.resolveShouldFail) {
            await dispatchHostMessage(
              page,
              createHostError(requestId, {
                code: "SAVE_FAILED",
                message:
                  fx.resolveFailMessage ??
                  "Failed to save: mock host simulated disk error.",
              }),
            );
            break;
          }
          const content = payload.content as string | undefined;
          const path = payload.path as string | undefined;
          if (content && /<<<<<<<|=======|>>>>>>>/.test(content)) {
            await dispatchHostMessage(
              page,
              createHostError(requestId, {
                code: "MARKERS_REMAIN",
                message:
                  "GitView found conflict markers still in the result. Resolve every conflict before marking the file as resolved.",
              }),
            );
            break;
          }
          if (settingsState.autoStageOnResolved !== false) {
            conflictFilesState = conflictFilesState.filter(
              (f) => f.relativePath !== path,
            );
            await dispatchHostMessage(
              page,
              createHostResponse(requestId, "merge.resolved", { path: path ?? "" }),
            );
          } else {
            await dispatchHostMessage(
              page,
              createHostResponse(requestId, "merge.saved", {
                path: path ?? "",
                hint: "Saved. Stage the file in Git to mark it resolved.",
              }),
            );
          }
          break;
        }
        case "blame.query": {
          const ref = payload.ref as string | undefined;
          const sideFromRef =
            ref === "MERGE_HEAD" || ref === "theirs" ? "theirs" : "ours";
          const side =
            (payload.side as "ours" | "theirs" | undefined) ?? sideFromRef;
          const path = payload.path as string | undefined;
          let lines =
            side === "theirs" ? fx.blameTheirs.lines : fx.blameOurs.lines;
          if (realGitRepoRoot && path) {
            const live = await gitService.blameFileForSide(
              realGitRepoRoot,
              path,
              side === "theirs" ? "theirs" : "ours",
            );
            if (live.ok && live.lines.length > 0) {
              lines = live.lines;
              setGitEffect({ type: "blame", relativePath: path, lines });
            }
          } else if (path && lines.length > 0) {
            setGitEffect({ type: "blame", relativePath: path, lines });
          }
          const snapshot = {
            repoId: E2E_REPO_ID,
            filePath: path ?? "",
            ref: "HEAD",
            lines,
            refreshedAt: Date.now(),
          };
          await dispatchHostMessage(
            page,
            createHostEvent("blame.snapshot", snapshot),
          );
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "blame.query", snapshot),
          );
          break;
        }
        case "log.query":
          await dispatchHostMessage(
            page,
            createHostEvent("log.snapshot", {
              repoId: E2E_REPO_ID,
              branch: fx.mergeDocument.oursLabel,
              commits: fx.fileLog.commits,
              refreshedAt: Date.now(),
              filters: { path: payload.path },
            }),
          );
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "log.query", {
              repoId: E2E_REPO_ID,
              branch: fx.mergeDocument.oursLabel,
              commits: fx.fileLog.commits,
              refreshedAt: Date.now(),
              filters: { path: payload.path },
            }),
          );
          break;
        case "log.changesFromSide":
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "log.changesFromSide", {
              side: payload.side,
              relativePath: payload.relativePath,
              mergeBase: fx.changesFromSide.commits[0]?.sha ?? "base",
              revisionRange: fx.changesFromSide.revisionRange,
              branchRef: "HEAD",
              commits: fx.changesFromSide.commits,
              allChangedPaths: ["file.txt"],
            }),
          );
          break;
        case "git.menuAction": {
          if (realGitRepoRoot && payload) {
            const menuPayload = payload as GitMenuActionPayload;
            const result = await executeWebviewGitMenuAction(
              realGitRepoRoot,
              menuPayload,
            );
            if (result.effect) {
              setGitEffect(result.effect);
            }
            if (result.diffPreview) {
              await dispatchHostMessage(
                page,
                createHostEvent("diff.preview", result.diffPreview),
              );
            }
            if (
              menuPayload.action === "annotateBlame" &&
              menuPayload.relativePath &&
              !menuPayload.isFolder
            ) {
              const lines = await fetchFileBlame(
                realGitRepoRoot,
                menuPayload.relativePath,
              );
              if (lines.length > 0) {
                setGitEffect({
                  type: "blame",
                  relativePath: menuPayload.relativePath,
                  lines,
                });
              }
              await dispatchHostMessage(
                page,
                createHostEvent("blame.annotateRequest", {
                  relativePath: menuPayload.relativePath,
                  side: "ours",
                }),
              );
            }
          }
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "git.menuAction", { ok: true }),
          );
          break;
        }
        case "history.openPanel": {
          if (realGitRepoRoot && payload) {
            const targetPath = payload.path as string;
            const isFolder = Boolean(payload.isFolder);
            const bootstrap = await handleGitHistoryOpen(
              realGitRepoRoot,
              targetPath,
              isFolder,
            );
            setGitEffect({
              type: "history",
              path: bootstrap.path,
              isFolder: bootstrap.isFolder,
              commits: bootstrap.commits,
            });
            if (openHistoryPageOnRequest) {
              await openRealGitHistoryPage(page, bootstrap);
            }
          }
          await dispatchHostMessage(
            page,
            createHostResponse(requestId, "history.openPanel", {
              path: payload.path as string,
              isFolder: Boolean(payload.isFolder),
            }),
          );
          break;
        }
        default:
          break;
      }
      return null;
    },
  );

  await page.addInitScript((repoId: string) => {
    window.__GITVIEW_BOOTSTRAP__ = { repoId };
    let acquired = false;
    window.acquireVsCodeApi = () => {
      if (acquired) {
        throw new Error("acquireVsCodeApi can only be called once");
      }
      acquired = true;
      return {
        postMessage: (msg: unknown) => {
          void (
            window as unknown as { __gitviewRouteMessage: (m: unknown) => void }
          ).__gitviewRouteMessage(msg);
        },
        getState: () => null,
        setState: () => {},
      };
    };
  }, E2E_REPO_ID);
}

export async function openConflictList(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("text=Merging branch");
}

export async function openMergeResolver(page: Page): Promise<void> {
  await page.click("text=file.txt");
  await page.click('button:has-text("Merge...")');
  await page.waitForSelector('[data-testid="pane-left"]');
}

export async function openGitHistoryFromConflictList(
  page: Page,
): Promise<void> {
  await page.click("text=file.txt", { button: "right" });
  await page.click("text=Show Git History");
  await page.waitForSelector('[data-testid="git-history-screen"]');
}

export async function annotateLeftPane(page: Page): Promise<void> {
  const leftPane = page.locator('[data-testid="pane-left"]');
  await leftPane.click({ button: "right" });
  await page.click("text=Annotate with Git Blame");
  await page.waitForSelector(".nx-blame");
}

export async function openChangesFromBranch(page: Page): Promise<void> {
  await page.getByText("Show Details").first().click();
  await page.waitForSelector('[data-testid="changes-from-branch-panel"]');
}
