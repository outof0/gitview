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

/**
 * Editor-area GitView tabs (diff/compare, blame) that can render a branch
 * overlay in place. New Branch / Branches from the native Git submenu prefer
 * posting to the currently active one instead of opening a new tab.
 *
 * Interaction contract (approved): overlay delivery is repo-scoped and
 * queued until the webview is ready. The caller passes the repository it resolved from the
 * clicked resource; only a visible panel registered for that repository
 * (or a registration with unknown repository, which matches anything) is
 * eligible, and the fallback panel opens unless delivery resolves true.
 * There is deliberately no native Quick Pick/InputBox branch here: when no
 * presentation exists the command layer already falls back to native UI, so
 * a second fallback inside the presentation would make the surface depend
 * on editor focus — the Branches E2E failure mode.
 */
export type GitViewOverlayTarget = {
  reveal: () => void;
  /** Resolve true only when the webview accepted the message. */
  deliver: (message: HostToWebview) => Promise<boolean>;
};

type PendingOverlayMessage = {
  message: HostToWebview;
  resolve: (delivered: boolean) => void;
};

type OverlayRegistration = {
  post: (message: HostToWebview) => Promise<boolean>;
  /** Repository the panel currently shows, or null when unknown. */
  repoId: string | null;
  /** True once the webview completed its ready handshake. */
  ready: boolean;
  /** Overlay requests parked until the ready handshake completes. */
  pending: PendingOverlayMessage[];
};

/** How long a boot-time overlay request waits for the ready handshake. */
export const OVERLAY_DELIVERY_TIMEOUT_MS = 10_000;

const overlayPanels = new Map<vscode.WebviewPanel, OverlayRegistration>();
let lastActiveOverlayPanel: vscode.WebviewPanel | null = null;

function trackOverlayPanel(
  panel: vscode.WebviewPanel,
  post: (message: HostToWebview) => Promise<boolean>,
  repoId: string | null,
): void {
  const registration: OverlayRegistration = {
    post,
    repoId,
    ready: false,
    pending: [],
  };
  overlayPanels.set(panel, registration);
  panel.onDidDispose(() => {
    overlayPanels.delete(panel);
    // A disposed panel never becomes ready: fail every parked request so its
    // caller falls through to the dedicated panel instead of hanging.
    for (const parked of registration.pending.splice(0)) {
      parked.resolve(false);
    }
    if (lastActiveOverlayPanel === panel) {
      lastActiveOverlayPanel = null;
    }
  });
  panel.onDidChangeViewState((event) => {
    if (event.webviewPanel.active) {
      lastActiveOverlayPanel = panel;
    } else if (lastActiveOverlayPanel === panel) {
      lastActiveOverlayPanel = null;
    }
  });
}

export function updateOverlayPanelRepo(
  panel: vscode.WebviewPanel,
  repoId: string | null,
): void {
  const registration = overlayPanels.get(panel);
  if (registration) {
    registration.repoId = repoId;
  }
}

/**
 * Mark a panel's webview as ready and flush parked overlay requests in order.
 * Call this from the panel's `webview.ready` handler.
 */
export function markOverlayPanelReady(panel: vscode.WebviewPanel): void {
  const registration = overlayPanels.get(panel);
  if (!registration || registration.ready) {
    return;
  }
  registration.ready = true;
  for (const parked of registration.pending.splice(0)) {
    void postToOverlayPanel(panel, parked.message).then(parked.resolve);
  }
}

function postToOverlayPanel(
  panel: vscode.WebviewPanel,
  message: HostToWebview,
): Promise<boolean> {
  const registration = overlayPanels.get(panel);
  if (!registration) {
    return Promise.resolve(false);
  }
  try {
    return Promise.resolve(registration.post(message)).then(
      (posted) =>
        posted === true &&
        overlayPanels.get(panel)?.ready === true,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Overlay delivery queued until the ready handshake.
 *
 * `webview.postMessage() === true` only means the message was posted — VS Code
 * explicitly does not guarantee a listener received it. Panels register before
 * their webview boots, so resolving true on a bare post lets a boot-time
 * action vanish while the caller suppresses its fallback. Instead a request
 * for a not-yet-ready panel parks until `markOverlayPanelReady` flushes it,
 * and resolves false when the panel is disposed or the handshake never
 * arrives — the caller then falls through to the dedicated panel.
 */
function deliverToOverlayPanel(
  panel: vscode.WebviewPanel,
  message: HostToWebview,
): Promise<boolean> {
  const registration = overlayPanels.get(panel);
  if (!registration) {
    return Promise.resolve(false);
  }
  if (registration.ready) {
    return postToOverlayPanel(panel, message);
  }
  return new Promise<boolean>((resolve) => {
    registration.pending.push({ message, resolve });
    const timer = setTimeout(() => {
      const index = registration.pending.findIndex(
        (parked) => parked.resolve === resolve,
      );
      if (index >= 0) {
        registration.pending.splice(index, 1);
        resolve(false);
      }
    }, OVERLAY_DELIVERY_TIMEOUT_MS);
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as unknown as { unref(): void }).unref();
    }
  });
}

/**
 * A GitView editor tab that can host a branch overlay right now.
 *
 * Only panels registered for the requested repository (or with unknown
 * repository) are eligible, so repo B's dialog can never render on repo A's
 * tab. Prefers the focused tab; falls back to the most recently focused
 * visible one (right-clicking Explorer moves focus to the sidebar, so
 * requiring focus would send the common case to a new tab anyway). Never
 * picks a merely open background tab.
 */
export function getGitViewOverlayTarget(
  repoId?: string,
): GitViewOverlayTarget | null {
  const panels = [...overlayPanels.keys()];
  const candidates = repoId
    ? panels.filter((panel) => {
        const registration = overlayPanels.get(panel)?.repoId;
        return registration === null || registration === undefined
          ? true
          : registration === repoId;
      })
    : panels;
  const picked =
    candidates.find((panel) => panel.active) ??
    (lastActiveOverlayPanel?.visible &&
    candidates.includes(lastActiveOverlayPanel)
      ? lastActiveOverlayPanel
      : undefined) ??
    candidates.find((panel) => panel.visible);
  if (!picked) {
    return null;
  }
  const registration = overlayPanels.get(picked);
  if (!registration) {
    return null;
  }
  return {
    reveal: () => picked.reveal(undefined, true),
    deliver: (message) => deliverToOverlayPanel(picked, message),
  };
}

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
  trackOverlayPanel(panel, (message) => Promise.resolve(webview.postMessage(message)), repoId ?? null);

  // Compare menu actions that open another compare update THIS panel.
  const postDiffPreview = async (preview: GitViewPreviewPayload) => {
    const nextRepoId =
      (await resolveDiffRepoId(options, workspaceRoot, preview.relativePath)) ??
      repoId;
    panel.title = preview.title;
    updateOverlayPanelRepo(panel, nextRepoId ?? null);
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
        markOverlayPanelReady(panel);
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
  trackOverlayPanel(panel, (message) => Promise.resolve(webview.postMessage(message)), resolvedRepoId ?? null);
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
      markOverlayPanelReady(panel);
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
