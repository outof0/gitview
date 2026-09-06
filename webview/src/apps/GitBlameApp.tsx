import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WorkspaceBlamePanel } from "../components/git/WorkspaceBlamePanel";
import { GitHistoryToolWindow } from "../screens/GitHistoryToolWindow";
import { ResizableSplit } from "../components/ui/ResizableSplit";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { useGitHistoryStore } from "../stores/gitHistoryStore";
import { createProtocolClient } from "../protocol/client";
import {
  isBlamePreview,
  isBlameSnapshotEvent,
  isDiffResult,
  isLogSnapshot,
} from "./historyBlameHostMessageGuards";
import {
  logSnapshotToStorePayload,
  requestCommitDetail as fetchCommitDetail,
  workspaceDiffToFileDiffView,
} from "./historyBlameAdapters";
import {
  isOpenOverlayEvent,
  type BranchOverlayRequest,
} from "./branchOverlayGuards";
import { BranchOverlay } from "../components/git/BranchOverlay";
import { warnHandshakeFailure } from "../lib/userError";
import type { BlameBootstrap } from "../types/gitviewBootstrap";
import type { BlameSnapshot } from "@gitview/shared/types/blame";

function isBlameBootstrap(
  value: Window["__GITVIEW_BOOTSTRAP__"],
): value is BlameBootstrap {
  return (
    value != null &&
    "relativePath" in value &&
    "repoId" in value &&
    "lines" in value
  );
}

const LOAD_TIMEOUT_MS = 12_000;
const ANNOTATE_LOG_LIMIT = 200;

function toSnapshot(bootstrap: BlameBootstrap): BlameSnapshot {
  return {
    repoId: bootstrap.repoId,
    filePath: bootstrap.relativePath,
    ref: "HEAD",
    lines: bootstrap.lines,
    truncated: bootstrap.truncated,
    refreshedAt: Date.now(),
  };
}

function hasBlameLines(bootstrap: BlameBootstrap | null | undefined): boolean {
  return (bootstrap?.lines?.length ?? 0) > 0;
}

export function GitBlameApp() {
  const { postMessage } = useVsCodeApi();
  const client = useMemo(() => createProtocolClient(postMessage), [postMessage]);
  const [bootstrap, setBootstrap] = useState<BlameBootstrap | null>(() => {
    const initial = window.__GITVIEW_BOOTSTRAP__;
    return isBlameBootstrap(initial) ? initial : null;
  });
  const [loading, setLoading] = useState(() => {
    const initial = window.__GITVIEW_BOOTSTRAP__;
    if (!isBlameBootstrap(initial)) {
      return true;
    }
    return initial.loading ?? !hasBlameLines(initial);
  });
  const [error, setError] = useState<string | null>(null);
  const [blamePreviewReady, setBlamePreviewReady] = useState(() => {
    const initial = window.__GITVIEW_BOOTSTRAP__;
    return isBlameBootstrap(initial) && hasBlameLines(initial);
  });
  const requestedBlameKey = useRef<string | null>(null);
  // New Branch / Branches overlay posted by the native Git submenu when this
  // tab is the active one — no new tab is opened.
  const [overlay, setOverlay] = useState<BranchOverlayRequest | null>(null);
  const filePath = bootstrap?.relativePath ?? null;
  const repoId = bootstrap?.repoId ?? null;
  const selectedSha = useGitHistoryStore((s) => s.selectedSha);

  const requestCommitDetail = useCallback(
    (sha: string) => {
      if (!repoId) {
        return;
      }
      fetchCommitDetail(client, repoId, sha);
    },
    [client, repoId],
  );

  useLayoutEffect(() => {
    useGitHistoryStore.setState({
      annotateMode: true,
      showDiffPreview: false,
      repoId: bootstrap?.repoId ?? null,
    });
  }, [bootstrap?.repoId]);

  const loadFileHistory = useCallback(
    (path: string) => {
      if (!repoId) {
        return;
      }
      useGitHistoryStore.setState({
        path,
        isFolder: false,
        loading: true,
        error: null,
        showDiffPreview: false,
        showDetails: true,
        annotateMode: true,
        commitDetailLoading: false,
        repoId,
      });
      void client
        .queryLog(repoId, {
          path,
          isFolder: false,
          limit: ANNOTATE_LOG_LIMIT,
        })
        .then((snapshot) => {
          const store = useGitHistoryStore.getState();
          store.setLogResult(logSnapshotToStorePayload(snapshot));
          const { annotateMode, selectedSha: sha } = useGitHistoryStore.getState();
          if (annotateMode && sha) {
            requestCommitDetail(sha);
          }
        })
        .catch((err) => {
          useGitHistoryStore.getState().setLogResult({
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    [client, repoId, requestCommitDetail],
  );

  useEffect(() => {
    // The host pushes `blame.preview` only after it answers this handshake
    // (src/webview/gitViewPresentation.ts). A failure is not fatal — the
    // timeout below renders "Blame preview did not load" — but it must leave a
    // trace, or a dead handshake looks exactly like a slow host.
    void client
      .ready("gitBlame")
      .catch((error: unknown) => warnHandshakeFailure("gitBlame", error));
  }, [client]);

  useEffect(() => {
    if (hasBlameLines(bootstrap)) {
      setLoading(false);
      setError(null);
      return;
    }
    if (!filePath) {
      setLoading(false);
      return;
    }
    if (!bootstrap?.loading) {
      setLoading(false);
      return;
    }
    if (!repoId) {
      return;
    }
    if (!blamePreviewReady) {
      return;
    }
    const requestKey = `${repoId}\0${filePath}`;
    if (requestedBlameKey.current === requestKey) {
      return;
    }
    requestedBlameKey.current = requestKey;
    setLoading(true);
    void client
      .queryBlame(repoId, filePath, "HEAD")
      .then((snapshot) => {
        setBootstrap((prev) => ({
          relativePath: snapshot.filePath,
          repoId: snapshot.repoId,
          lines: snapshot.lines,
          truncated: snapshot.truncated,
          loading: false,
          headSha: prev?.headSha,
          // Keep the cursor line captured when Annotate was opened.
          focusLine: prev?.focusLine,
        }));
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (requestedBlameKey.current === requestKey) {
          requestedBlameKey.current = null;
        }
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });
    const timer = window.setTimeout(() => {
      setLoading(false);
      setError(
        "Blame preview did not load. Reload the window, then run Annotate again from Explorer.",
      );
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [blamePreviewReady, bootstrap, filePath, repoId, client]);

  useEffect(() => {
    if (filePath && hasBlameLines(bootstrap)) {
      loadFileHistory(filePath);
    }
  }, [filePath, bootstrap?.lines.length, loadFileHistory]);

  useEffect(() => {
    const eventRequestId = (data: unknown): string | undefined => {
      const id = (data as { requestId?: unknown } | null)?.requestId;
      return typeof id === "string" && id.length > 0 ? id : undefined;
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (isOpenOverlayEvent(data)) {
        setOverlay(data.payload);
        return;
      }
      if (isBlamePreview(data)) {
        setBlamePreviewReady(true);
        requestedBlameKey.current = null;
        setBootstrap((prev) => ({
          relativePath: data.payload.relativePath,
          repoId: repoId ?? prev?.repoId ?? bootstrap?.repoId ?? "",
          lines: data.payload.lines,
          headSha: data.payload.headSha,
          loading: data.payload.loading,
          truncated: data.payload.truncated,
          focusLine:
            data.payload.focusLine ?? prev?.focusLine ?? bootstrap?.focusLine,
        }));
        setLoading(data.payload.loading ?? false);
        setError(null);
        return;
      }
      if (isBlameSnapshotEvent(data)) {
        if (!client.isCurrentEvent("blame.snapshot", eventRequestId(data))) {
          return;
        }
        setBootstrap((prev) => ({
          relativePath: data.payload.filePath,
          repoId: data.payload.repoId,
          lines: data.payload.lines,
          truncated: data.payload.truncated,
          loading: false,
          focusLine: prev?.focusLine,
          headSha: prev?.headSha,
        }));
        setLoading(false);
        setError(null);
        return;
      }
      if (isLogSnapshot(data)) {
        if (!client.isCurrentEvent("log.snapshot", eventRequestId(data))) {
          return;
        }
        const store = useGitHistoryStore.getState();
        store.setLogResult(logSnapshotToStorePayload(data.payload));
        return;
      }
      if (isDiffResult(data)) {
        const store = useGitHistoryStore.getState();
        const { selectedSha: sha, selectedChangedFilePath: path } = store;
        if (!sha || !path) {
          return;
        }
        if (!client.isCurrentEvent("diff.result", eventRequestId(data))) {
          return;
        }
        store.setFileDiffResult({
          sha,
          path,
          diff: workspaceDiffToFileDiffView(data.payload),
        });
        return;
      }
      client.handleHostMessage(data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [client, requestCommitDetail, repoId, bootstrap?.repoId]);

  const handleOpenCommit = useCallback(
    (sha: string) => {
      useGitHistoryStore.getState().selectCommit(sha);
      requestCommitDetail(sha);
    },
    [requestCommitDetail],
  );

  const handleSaveContent = useCallback(
    async (content: string) => {
      if (!repoId || !filePath) {
        throw new Error("No file open");
      }
      await client.writeFile(repoId, filePath, content);
    },
    [client, repoId, filePath],
  );

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      // Update VS Code webview tab title: "● file.ts" when unsaved
      postMessage({
        type: "blame.setDirty",
        payload: { dirty, path: filePath },
      });
    },
    [postMessage, filePath],
  );

  const snapshot = bootstrap ? toSnapshot(bootstrap) : null;
  const hasFile = Boolean(filePath);

  return (
    <div
      className="h-full min-h-0 w-full flex flex-col text-foreground bg-vscode-editor-bg font-ui"
      data-testid="git-blame-app"
    >
      {overlay && (
        <BranchOverlay
          request={overlay}
          client={client}
          onClose={() => setOverlay(null)}
        />
      )}
      {hasFile ? (
        <ResizableSplit
          direction="vertical"
          initialPercent={68}
          minFirstPercent={36}
          minSecondPercent={18}
          storageKey="gitView.blame.editorLogSplit.v2"
          className="flex-1 min-h-0 h-full"
          first={
            <WorkspaceBlamePanel
              snapshot={snapshot}
              filePath={filePath}
              headSha={bootstrap?.headSha}
              loading={loading}
              error={error}
              selectedSha={selectedSha}
              focusLine={bootstrap?.focusLine}
              onOpenCommit={handleOpenCommit}
              onSaveContent={handleSaveContent}
              onDirtyChange={handleDirtyChange}
            />
          }
          second={
            <div
              className="h-full min-h-0 flex flex-col"
              data-testid="blame-git-log-pane"
            >
              <GitHistoryToolWindow
                embedded
                twoPaneLayout
                currentSha={bootstrap?.headSha}
              />
            </div>
          }
        />
      ) : (
        <WorkspaceBlamePanel
          snapshot={null}
          filePath={null}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
}
