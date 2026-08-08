import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import {
  NOOP_LOGGER,
  type Logger,
} from "../observability/logger";
import type { HostToWebview } from "../shared/protocol";

import type { BlameLine } from "../types/blame";
import type { FileDiffView } from "../types/blame";
import { getWebviewHtml } from "./getWebviewHtml";
import { readGitWorkspaceSettings } from "../config/readGitWorkspaceSettings";
import {
  createHostEvent,
  createHostResponse,
  parseWebviewRequest,
} from "../shared/protocol";
import { createSafeWebviewPoster } from "./safeWebviewPoster";
import {
  createGitViewPanelRouter,
  resolveRepoIdForResource,
} from "./gitViewPanelRouter";

export type GitViewPreviewPayload = {
  relativePath: string;
  title: string;
  diff: FileDiffView;
};

export type GitViewBlamePreviewPayload = {
  relativePath: string;
  lines: BlameLine[];
  headSha?: string | null;
  loading?: boolean;
  truncated?: boolean;
  /** 1-based line to reveal after the annotate editor loads. */
  focusLine?: number;
};

const diffPanels = new Map<string, vscode.WebviewPanel>();

type BlamePanelState = {
  panel: vscode.WebviewPanel;
  repoId: string;
  relativePath: string;
};

const blamePanels = new Map<string, BlamePanelState>();

function diffPanelKey(relativePath: string, workspaceRoot?: string): string {
  return `${workspaceRoot ?? ""}:diff:${relativePath}`;
}

function blamePanelKey(relativePath: string, workspaceRoot?: string): string {
  return `${workspaceRoot ?? ""}:blame:${relativePath}`;
}

function encodeBootstrap(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

type OpenGitViewPanelOptions = {
  /** Keep a single diff tab (annotate changed-files navigation). */
  reusePanel?: boolean;
  /** Open as a regular tab in the current editor group instead of splitting beside. */
  openInActiveColumn?: boolean;
  /** Instance-scoped diagnostics for asynchronous webview delivery. */
  logger?: Logger;
  /** Required for right-click Annotate from the compare panel. */
  getGitView?: () => GitViewContext;
};

/** Opens (or reveals) a GitView diff panel — does not depend on the Git extension. */
export async function openGitViewPanel(
  context: vscode.ExtensionContext,
  payload: GitViewPreviewPayload,
  workspaceRoot?: string,
  options?: OpenGitViewPanelOptions,
): Promise<void> {
  try {
    await revealOrCreateDiffPanel(context, payload, workspaceRoot, options);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Could not open diff for ${payload.relativePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

function annotateRevisionDiffPanelKey(workspaceRoot?: string): string {
  return `${workspaceRoot ?? ""}:diff:annotate-revision`;
}

async function resolveDiffRepoId(
  options: OpenGitViewPanelOptions | undefined,
  workspaceRoot: string | undefined,
  relativePath: string,
): Promise<string | undefined> {
  const getGitView = options?.getGitView;
  if (!getGitView || !workspaceRoot) {
    return undefined;
  }
  try {
    return (
      (await resolveRepoIdForResource(
        getGitView(),
        workspaceRoot,
        relativePath,
      )) ?? undefined
    );
  } catch {
    return undefined;
  }
}

async function revealOrCreateDiffPanel(
  context: vscode.ExtensionContext,
  payload: GitViewPreviewPayload,
  workspaceRoot?: string,
  options?: OpenGitViewPanelOptions,
): Promise<void> {
  const key = options?.reusePanel
    ? annotateRevisionDiffPanelKey(workspaceRoot)
    : diffPanelKey(payload.relativePath, workspaceRoot);
  const existing = diffPanels.get(key);
  const targetColumn = options?.openInActiveColumn
    ? vscode.ViewColumn.Active
    : vscode.ViewColumn.Beside;

  const repoId = await resolveDiffRepoId(
    options,
    workspaceRoot,
    payload.relativePath,
  );
  const previewWithRepo = { ...payload, repoId };

  if (existing) {
    existing.title = payload.title;
    existing.reveal(targetColumn, true);
    await existing.webview.postMessage(
      createHostEvent("diff.preview", previewWithRepo),
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "gitViewGitDiff",
    payload.title,
    { viewColumn: targetColumn, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist"),
        vscode.Uri.joinPath(context.extensionUri, "webview", "dist"),
      ],
    },
  );
  const webview = panel.webview;
  const poster = createSafeWebviewPoster<HostToWebview>(
    webview,
    options?.logger ?? NOOP_LOGGER,
    "gitDiff",
  );
  panel.onDidDispose(() => {
    poster.dispose();
    diffPanels.delete(key);
  });

  // Compare menu actions that open another compare update THIS panel.
  const postDiffPreview = async (preview: GitViewPreviewPayload) => {
    const nextRepoId =
      (await resolveDiffRepoId(options, workspaceRoot, preview.relativePath)) ??
      repoId;
    panel.title = preview.title;
    await poster.postMessage(
      createHostEvent("diff.preview", { ...preview, repoId: nextRepoId }),
    );
  };

  const getGitView = options?.getGitView;
  const router =
    getGitView &&
    createGitViewPanelRouter(
      context,
      getGitView(),
      poster.postMessage,
      workspaceRoot,
      { postDiffPreview },
    );

  webview.onDidReceiveMessage((raw: unknown) => {
    void (async () => {
      const request = parseWebviewRequest(raw);
      if (request?.type === "webview.ready") {
        poster.postMessage(
          createHostResponse(request.requestId, "webview.ready", {
            surface: request.payload.surface,
            settings: readGitWorkspaceSettings(),
          }),
        );
        poster.postMessage(createHostEvent("diff.preview", previewWithRepo));
        return;
      }
      // Same UX as Explorer → Annotate: open the full Annotate (blame + log) panel.
      if (request?.type === "diff.annotate") {
        const gitView = options?.getGitView?.();
        if (!gitView) {
          poster.postMessage(
            createHostResponse(request.requestId, "diff.annotate", {
              ok: true as const,
            }),
          );
          void vscode.window.showWarningMessage(
            "Annotate is not available from this compare panel.",
          );
          return;
        }
        const rel =
          request.payload.relativePath.trim() || payload.relativePath;
        try {
          await openGitViewBlamePanel(
            context,
            gitView,
            {
              relativePath: rel,
              lines: [],
              loading: true,
              focusLine: request.payload.focusLine,
            },
            workspaceRoot,
          );
          poster.postMessage(
            createHostResponse(request.requestId, "diff.annotate", {
              ok: true as const,
            }),
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not open Annotate";
          void vscode.window.showErrorMessage(message);
          poster.postMessage(
            createHostResponse(request.requestId, "diff.annotate", {
              ok: true as const,
            }),
          );
        }
        return;
      }
      if (router) {
        await router.handleRawMessage(raw);
      }
    })();
  });

  const bootstrap = encodeBootstrap(previewWithRepo);
  webview.html = await getWebviewHtml(
    webview,
    context.extensionUri,
    { app: "gitDiff" },
  );
  webview.html = webview.html.replace(
    `window.__GITVIEW_APP__="gitDiff"`,
    `window.__GITVIEW_APP__="gitDiff";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
  );

  diffPanels.set(key, panel);
}

/** Opens (or reveals) a GitView blame webview — annotate gutter + syntax-highlighted code + Git Log. */
export async function openGitViewBlamePanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  payload: GitViewBlamePreviewPayload,
  workspaceRoot?: string,
  _repoRoot?: string,
): Promise<void> {
  try {
    await revealOrCreateBlamePanel(
      context,
      gitView,
      payload,
      workspaceRoot,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Could not open blame for ${payload.relativePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function revealOrCreateBlamePanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  payload: GitViewBlamePreviewPayload,
  workspaceRoot?: string,
): Promise<void> {
  const key = blamePanelKey(payload.relativePath, workspaceRoot);
  const fileName =
    payload.relativePath.split("/").pop() ?? payload.relativePath;
  const title = fileName;
  const resolvedWorkspaceRoot =
    workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  if (!resolvedWorkspaceRoot) {
    void vscode.window.showWarningMessage(
      "Annotate requires an open workspace folder.",
    );
    return;
  }

  const resolvedRepoId = await resolveRepoIdForResource(
    gitView,
    resolvedWorkspaceRoot,
    payload.relativePath,
  );
  if (!resolvedRepoId) {
    void vscode.window.showWarningMessage(
      "Annotate requires a file inside a Git repository.",
    );
    return;
  }

  const existing = blamePanels.get(key);
  if (existing) {
    existing.relativePath = payload.relativePath;
    existing.panel.title = title;
    existing.panel.reveal(vscode.ViewColumn.Active, false);
    await existing.panel.webview.postMessage(
      createHostEvent("blame.preview", {
        ...payload,
        focusLine: payload.focusLine,
      }),
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "gitViewGitBlame",
    title,
    { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist"),
        vscode.Uri.joinPath(context.extensionUri, "webview", "dist"),
      ],
    },
  );
  const webview = panel.webview;
  const poster = createSafeWebviewPoster<HostToWebview>(
    webview,
    gitView.logger,
    "gitBlame",
  );
  const postMessage = poster.postMessage;
  panel.onDidDispose(() => {
    poster.dispose();
    blamePanels.delete(key);
  });
  const router = createGitViewPanelRouter(
    context,
    gitView,
    postMessage,
    resolvedWorkspaceRoot,
  );

  const panelState: BlamePanelState = {
    panel,
    repoId: resolvedRepoId,
    relativePath: payload.relativePath,
  };

  webview.onDidReceiveMessage(async (raw: unknown) => {
    // Dirty title marker for the webview tab (● file.ts) — fire-and-forget
    if (
      raw &&
      typeof raw === "object" &&
      (raw as { type?: string }).type === "blame.setDirty"
    ) {
      const dirty = Boolean(
        (raw as { payload?: { dirty?: boolean } }).payload?.dirty,
      );
      panel.title = dirty ? `\u25CF ${fileName}` : fileName;
      return;
    }

    const request = parseWebviewRequest(raw);
    if (
      request?.type === "webview.ready" &&
      request.payload.surface === "gitBlame"
    ) {
      await router.handleRawMessage(raw);
      postMessage(createHostEvent("blame.preview", payload));
      return;
    }
    await router.handleRawMessage(raw);
  });

  const bootstrap = encodeBootstrap({
    relativePath: payload.relativePath,
    repoId: resolvedRepoId,
    lines: [],
    loading: payload.loading,
    truncated: payload.truncated,
    focusLine: payload.focusLine,
  });
  webview.html = await getWebviewHtml(webview, context.extensionUri, {
    app: "gitBlame",
  });
  webview.html = webview.html.replace(
    `window.__GITVIEW_APP__="gitBlame"`,
    `window.__GITVIEW_APP__="gitBlame";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
  );

  blamePanels.set(key, panelState);
}
