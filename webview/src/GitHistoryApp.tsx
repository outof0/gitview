import { useEffect, useMemo } from "react";
import { useTheme } from "./hooks/useTheme";
import { useVsCodeApi } from "./hooks/useVsCodeApi";
import { useWebviewContextMenuGuard } from "./hooks/useWebviewContextMenuGuard";
import { GitHistoryToolWindow } from "./screens/GitHistoryToolWindow";
import { useGitHistoryStore } from "./stores/gitHistoryStore";
import { createProtocolClient } from "./protocol/client";
import {
  isDiffResult,
  isHistoryInit,
  isLogSnapshot,
} from "./apps/historyBlameHostMessageGuards";
import {
  logSnapshotToStorePayload,
  workspaceDiffToFileDiffView,
} from "./apps/historyBlameAdapters";

function isHistoryBootstrap(
  value: Window["__GITVIEW_BOOTSTRAP__"],
): value is { path: string; isFolder: boolean; repoId: string } {
  return (
    value != null &&
    "path" in value &&
    "repoId" in value &&
    typeof (value as { repoId?: string }).repoId === "string"
  );
}

/**
 * Show History — file-history tool window:
 * full tool window with commits + instant diff (no stacked full-file editor).
 * Folder history keeps commits | files | diff.
 */
export function GitHistoryApp() {
  const theme = useTheme();
  const { postMessage } = useVsCodeApi();
  const client = useMemo(() => createProtocolClient(postMessage), [postMessage]);
  const store = useGitHistoryStore;

  useWebviewContextMenuGuard();

  useEffect(() => {
    const bootstrap = window.__GITVIEW_BOOTSTRAP__;
    if (isHistoryBootstrap(bootstrap)) {
      store.setState({
        path: bootstrap.path,
        isFolder: bootstrap.isFolder,
        repoId: bootstrap.repoId,
        loading: true,
        showDiffPreview: true,
        annotateMode: false,
      });
    }
  }, [store]);

  useEffect(() => {
    // The host pushes `history.init` only after it answers this handshake, so
    // swallowing a failure here is not cosmetic: the tool window would sit on
    // "Loading history…" forever, with nothing on screen and nothing in the log.
    void client.ready("gitHistory").catch((error: unknown) => {
      store.getState().setLogResult({
        error:
          error instanceof Error
            ? error.message
            : "Could not start the Git History view.",
      });
    });
  }, [client, store]);

  useEffect(() => {
    const eventRequestId = (data: unknown): string | undefined => {
      const id = (data as { requestId?: unknown } | null)?.requestId;
      return typeof id === "string" && id.length > 0 ? id : undefined;
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (isHistoryInit(data)) {
        store.getState().init(data.payload);
        return;
      }
      if (isLogSnapshot(data)) {
        if (client.isCurrentEvent("log.snapshot", eventRequestId(data))) {
          store.getState().setLogResult(logSnapshotToStorePayload(data.payload));
        }
        return;
      }
      if (isDiffResult(data)) {
        const { selectedSha: sha, selectedChangedFilePath: filePath } =
          store.getState();
        if (!sha || !filePath) {
          return;
        }
        if (!client.isCurrentEvent("diff.result", eventRequestId(data))) {
          return;
        }
        store.getState().setFileDiffResult({
          sha,
          path: filePath,
          diff: workspaceDiffToFileDiffView(data.payload),
        });
        return;
      }
      client.handleHostMessage(data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [client, store]);

  const themeClass =
    theme === "high-contrast-light"
      ? "vscode-high-contrast-light"
      : theme === "high-contrast"
        ? "vscode-high-contrast"
        : theme === "light"
          ? "vscode-light"
          : "vscode-dark";

  return (
    <div
      className={`h-screen w-screen overflow-hidden font-ui text-ui bg-vscode-editor-bg text-vscode-editor-fg ${themeClass}`}
      data-testid="git-history-app"
    >
      <div
        className="h-full min-h-0 flex flex-col"
        data-testid="history-git-log-pane"
      >
        <GitHistoryToolWindow embedded />
      </div>
    </div>
  );
}
