import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitHistoryDiffViewer } from "../components/git/GitHistoryDiffViewer";
import { GitCompareToolbar } from "../components/git/GitCompareToolbar";
import { DiffViewerToolbar } from "../components/git/DiffViewerToolbar";
import {
  DEFAULT_DIFF_VIEWER_OPTIONS,
  type DiffViewerOptions,
  type MonacoDiffViewerHandle,
} from "../components/git/MonacoDiffViewer";
import { GitContextMenuItems } from "../components/git/GitContextMenuItems";
import {
  CompareSplitView,
  type CompareContextMenuEvent,
} from "../components/git/CompareSplitView";
import { ToolEmptyState } from "../components/ui/ToolEmptyState";
import { ContextMenu } from "../components/ui/ContextMenu";
import { MenuItem } from "../components/ui/MenuItem";
import { EyeOff } from "lucide-react";
import { GitHistoryToolWindow } from "../screens/GitHistoryToolWindow";
import { useGitHistoryStore } from "../stores/gitHistoryStore";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { createProtocolClient } from "../protocol/client";
import type { StandaloneDiffPreview } from "@gitview/shared/types/diff";
import type { BlameLineEntry } from "@gitview/shared/types/blame";
import type { DiffBootstrap } from "../types/gitviewBootstrap";
import type { GitMenuAction } from "@gitview/types";
import { buildGitMenuActionPayload } from "@gitview/types";
import {
  isDiffPreview,
  isErrorNotification,
} from "./gitDiffHostMessageGuards";

function isDiffBootstrap(
  value: Window["__GITVIEW_BOOTSTRAP__"],
): value is DiffBootstrap {
  return value != null && "relativePath" in value && "diff" in value;
}

export const GIT_DIFF_LOAD_TIMEOUT_MS = 12_000;

/** JetBrains-style line menu: only actions that apply on a compared file. */
const COMPARE_LINE_MENU_ACTIONS = [
  "showHistory",
  "compareWithRevision",
  "compareWithBranch",
  "showDiff",
  "annotateBlame",
] as const;

function DiffEmptyToolbar() {
  return (
    <header
      className="nx-tool-titlebar shrink-0 flex items-center gap-2 h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] px-[var(--nx-pad-x)] border-b border-vscode-panel-border bg-vscode-titlebar-bg font-[family-name:var(--nx-font-ui)]"
      data-testid="git-compare-toolbar-empty"
    >
      <span
        className="text-[length:var(--nx-font-size-ui)] opacity-75 leading-none shrink-0"
        aria-hidden
      >
        ⇄
      </span>
      <span className="text-[length:var(--nx-font-size-ui)] font-semibold font-editor">
        Compare
      </span>
    </header>
  );
}

type DiffContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  lineNumber: number;
  side: "left" | "right";
};

/** Point the shared history store at this file, the way file Annotate does. */
function openFileLog(repoId: string, relativePath: string) {
  const store = useGitHistoryStore.getState();
  if (store.repoId === repoId && store.path === relativePath) {
    return;
  }
  useGitHistoryStore.setState({
    repoId,
    path: relativePath,
    isFolder: false,
    loading: true,
    error: null,
    showDiffPreview: false,
    showDetails: true,
    annotateMode: true,
    commitDetailLoading: false,
  });
}

/** Map pane labels to a git blame ref (Working Tree → HEAD). */
function blameRefFromLabel(label: string | undefined): string {
  if (!label) {
    return "HEAD";
  }
  if (/working\s*tree/i.test(label) || label === "Empty" || label === "Deleted") {
    return "HEAD";
  }
  return label.trim();
}

/**
 * Git Compare.
 *
 * Annotate keeps the side-by-side diff and adds a blame column to one side at
 * a time, mirrored around the centre. It reuses the same log pane as file
 * Annotate, so clicking a blame cell lands on that commit there.
 */
export function GitDiffApp() {
  const { postMessage } = useVsCodeApi();
  const client = useMemo(() => createProtocolClient(postMessage), [postMessage]);
  const [preview, setPreview] = useState<StandaloneDiffPreview | null>(() => {
    const initial = window.__GITVIEW_BOOTSTRAP__;
    return isDiffBootstrap(initial) ? initial : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [contextMenu, setContextMenu] = useState<DiffContextMenuState | null>(
    null,
  );

  // Annotate column state — each side is toggled independently.
  const [annotate, setAnnotate] = useState({ left: false, right: false });
  const [leftBlame, setLeftBlame] = useState<BlameLineEntry[] | null>(null);
  const [rightBlame, setRightBlame] = useState<BlameLineEntry[] | null>(null);
  const [blameLoading, setBlameLoading] = useState({
    left: false,
    right: false,
  });
  // The log pane under an annotated compare is the same one file Annotate uses,
  // so commit selection lives in the shared history store.
  const selectedSha = useGitHistoryStore((s) => s.selectedSha);

  // Diff viewer toolbar (JetBrains parity: navigation, whitespace, viewer mode)
  const [viewerOptions, setViewerOptions] = useState<DiffViewerOptions>(
    DEFAULT_DIFF_VIEWER_OPTIONS,
  );
  const [diffCount, setDiffCount] = useState<number | null>(null);
  const viewerRef = useRef<MonacoDiffViewerHandle | null>(null);

  const repoId = preview?.repoId ?? null;
  const relativePath = preview?.relativePath ?? null;

  useEffect(() => {
    void client.ready("gitDiff").catch(() => {});
  }, [client]);

  useEffect(() => {
    if (preview) {
      setTimedOut(false);
      setError(null);
      return;
    }
    const timer = window.setTimeout(
      () => setTimedOut(true),
      GIT_DIFF_LOAD_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (isDiffPreview(data)) {
        setPreview(data.payload);
        setError(null);
        setTimedOut(false);
        setDiffCount(null);
        // New comparison — reset annotate columns
        setAnnotate({ left: false, right: false });
        setLeftBlame(null);
        setRightBlame(null);
        return;
      }
      if (isErrorNotification(data)) {
        setError(data.payload.message);
        return;
      }
      client.handleHostMessage(data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [client]);

  const leftLabel = preview?.diff.left?.label;
  const rightLabel = preview?.diff.right?.label;

  let emptyTitle = "Loading diff…";
  let emptyHint = "Preparing side-by-side comparison.";
  if (error) {
    emptyTitle = "Could not load diff";
    emptyHint = error;
  } else if (timedOut) {
    emptyTitle = "Diff preview did not load";
    emptyHint =
      "Reload the window, then run Compare or Show Diff again from Explorer.";
  }

  const openEditorContextMenu = (event: CompareContextMenuEvent) => {
    setContextMenu({
      visible: true,
      x: event.x,
      y: event.y,
      lineNumber: event.lineNumber,
      side: event.side,
    });
  };

  const loadBlameForSide = useCallback(
    async (side: "left" | "right") => {
      if (!repoId || !relativePath || !preview) {
        setError(
          "Annotate needs a repository. Re-open Compare from a file in the workspace.",
        );
        return;
      }
      const pane = side === "left" ? preview.diff.left : preview.diff.right;
      setBlameLoading((prev) => ({ ...prev, [side]: true }));
      setAnnotate((prev) => ({ ...prev, [side]: true }));
      openFileLog(repoId, relativePath);
      try {
        const response = await client.queryBlame(
          repoId,
          relativePath,
          blameRefFromLabel(pane?.label),
        );
        const lines = response.lines ?? [];
        if (side === "left") {
          setLeftBlame(lines);
        } else {
          setRightBlame(lines);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not load blame");
        setAnnotate((prev) => ({ ...prev, [side]: false }));
      } finally {
        setBlameLoading((prev) => ({ ...prev, [side]: false }));
      }
    },
    [client, repoId, relativePath, preview],
  );

  const closeAnnotations = useCallback((side: "left" | "right") => {
    setAnnotate((prev) => ({ ...prev, [side]: false }));
  }, []);

  const onSelectBlame = useCallback(
    (sha: string) => {
      useGitHistoryStore.getState().selectCommit(sha);
      if (!repoId) {
        return;
      }
      void client
        .commitDetail(repoId, sha)
        .then((payload) => {
          const store = useGitHistoryStore.getState();
          if (payload.error) {
            store.setCommitDetailError(payload.error.message);
          } else if (payload.commit) {
            store.applyCommitDetail(payload.commit);
          }
        })
        .catch((err: unknown) => {
          useGitHistoryStore
            .getState()
            .setCommitDetailError(
              err instanceof Error ? err.message : "Could not load commit",
            );
        });
    },
    [client, repoId],
  );

  const dispatchGitAction = useCallback(
    (action: GitMenuAction) => {
      if (!relativePath) {
        return;
      }
      if (!repoId) {
        setError("Git actions need a repository context.");
        return;
      }
      void client
        .gitMenuAction(
          repoId,
          buildGitMenuActionPayload(action, {
            relativePath,
            isFolder: false,
          }),
        )
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Git action failed");
        });
    },
    [client, relativePath, repoId],
  );

  const showHistory = useCallback(() => {
    if (!relativePath || !repoId) {
      setError("Show History needs a repository context.");
      return;
    }
    void client
      .gitMenuAction(
        repoId,
        buildGitMenuActionPayload("showHistory", {
          relativePath,
          isFolder: false,
        }),
      )
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open history");
      });
  }, [client, relativePath, repoId]);

  const goToDifference = useCallback((target: "next" | "previous") => {
    viewerRef.current?.goToDiff(target);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F7" || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      goToDifference(event.shiftKey ? "previous" : "next");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToDifference]);

  const splitReady =
    preview &&
    preview.diff.layout === "split" &&
    preview.diff.left &&
    preview.diff.right;
  const annotateAny = annotate.left || annotate.right;
  const annotateView = Boolean(annotateAny && splitReady);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden bg-vscode-editor-bg text-vscode-editor-fg font-[family-name:var(--nx-font-ui)]"
      data-testid="git-diff-app"
      data-annotate={annotateAny ? "true" : "false"}
    >
      {preview ? (
        <div className="shrink-0">
          <GitCompareToolbar
            filePath={preview.relativePath}
            title={preview.title}
            leftLabel={leftLabel}
            rightLabel={rightLabel}
          />
          {!annotateView && (
            <DiffViewerToolbar
              options={viewerOptions}
              onOptionsChange={setViewerOptions}
              onPrevDifference={() => goToDifference("previous")}
              onNextDifference={() => goToDifference("next")}
              diffCount={diffCount}
            />
          )}
        </div>
      ) : (
        <DiffEmptyToolbar />
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {!preview ? (
          <ToolEmptyState
            title={emptyTitle}
            hint={emptyHint}
            testId="git-diff-empty"
            className="h-full"
          />
        ) : annotateView ? (
          <CompareSplitView
            left={preview.diff.left!}
            right={preview.diff.right!}
            filePath={preview.relativePath}
            hideHeaders={false}
            annotateLeft={annotate.left}
            annotateRight={annotate.right}
            leftBlame={leftBlame}
            rightBlame={rightBlame}
            leftBlameLoading={blameLoading.left}
            rightBlameLoading={blameLoading.right}
            selectedSha={selectedSha}
            onSelectBlame={onSelectBlame}
            onContextMenu={openEditorContextMenu}
            bottomPanel={
              <div
                className="h-full min-h-0 flex flex-col"
                data-testid="compare-git-log-pane"
              >
                <GitHistoryToolWindow embedded twoPaneLayout />
              </div>
            }
          />
        ) : (
          <GitHistoryDiffViewer
            diff={preview.diff}
            filePath={preview.relativePath}
            variant="standalone"
            options={viewerOptions}
            onDiffCountChange={setDiffCount}
            viewerRef={viewerRef}
            onEditorContextMenu={(e) =>
              openEditorContextMenu({
                x: e.x,
                y: e.y,
                lineNumber: e.lineNumber,
                side: e.side,
              })
            }
          />
        )}
      </div>

      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        testId="git-diff-context-menu"
        ariaLabel="Compare context menu"
        minWidth={260}
      >
        {contextMenu && (
          <>
            <GitContextMenuItems
              isFolder={false}
              onClose={() => setContextMenu(null)}
              onShowHistory={showHistory}
              onGitAction={dispatchGitAction}
              onAnnotateBlame={() => {
                setContextMenu(null);
                void loadBlameForSide(contextMenu.side);
              }}
              showAnnotate={!annotate[contextMenu.side]}
              allowedActions={COMPARE_LINE_MENU_ACTIONS}
            />
            {annotate[contextMenu.side] && (
              <MenuItem
                label="Close Annotations"
                icon={<EyeOff size={14} strokeWidth={1.75} aria-hidden />}
                testId="git-diff-close-annotations"
                onClick={() => {
                  setContextMenu(null);
                  closeAnnotations(contextMenu.side);
                }}
              />
            )}
          </>
        )}
      </ContextMenu>
    </div>
  );
}
