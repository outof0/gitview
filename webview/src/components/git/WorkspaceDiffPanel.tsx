import { SelectField } from "../ui/SelectField";
import { Button } from "../ui/Button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { DiffLineSelection, WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import { changedFileStatusLabel } from "./changedFileStatus";
import { splitWorkspacePath } from "../../lib/fileStatusTheme";
import {
  lineSelectionKey,
} from "../../lib/diffLineSelection";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { WhitespacePolicy } from "../../stores/gitViewStore";
import { WHITESPACE_LABELS, toFileDiffView } from "./workspaceDiffPanel/workspaceDiffPanelUtils";
import { SplitWithHunks } from "./workspaceDiffPanel/WorkspaceDiffSplitView";
import { UnifiedWithHunks } from "./workspaceDiffPanel/WorkspaceDiffUnifiedView";
import { MonacoDiffViewer } from "./MonacoDiffViewer";
import { useVsCodeApi } from "../../hooks/useVsCodeApi";
import { createProtocolClient } from "../../protocol/client";
import { reportDiffOpenError } from "../../lib/userError";

type WorkspaceDiffPanelProps = {
  document: WorkspaceDiffDocument | null;
  filePath: string | null;
  loading?: boolean;
  error?: string | null;
  showHunkActions?: boolean;
  stagedView?: boolean;
  busy?: boolean;
  onStageHunk?: (hunkIndex: number) => void;
  onUnstageHunk?: (hunkIndex: number) => void;
  onStageLines?: (lines: DiffLineSelection[]) => void;
  onUnstageLines?: (lines: DiffLineSelection[]) => void;
  onShelveHunk?: (hunkIndex: number) => void;
  showLogActions?: boolean;
  canDropSelected?: boolean;
  onDropHunk?: (hunkIndex: number) => void;
  onCherryPickLines?: (lines: DiffLineSelection[]) => void;
  onRevertLines?: (lines: DiffLineSelection[]) => void;
  onDropLines?: (lines: DiffLineSelection[]) => void;
  onToggleStagedView?: () => void;
  borderless?: boolean;
};

function clearSelection(
  setSelectedLineKeys: (keys: Set<string>) => void,
  setRangeAnchor: (anchor: DiffLineSelection | null) => void,
) {
  setSelectedLineKeys(new Set());
  setRangeAnchor(null);
}

export function WorkspaceDiffPanel({
  document,
  filePath,
  loading = false,
  error = null,
  showHunkActions = false,
  stagedView = false,
  busy = false,
  onStageHunk,
  onUnstageHunk,
  onStageLines,
  onUnstageLines,
  onShelveHunk,
  showLogActions = false,
  canDropSelected = false,
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
  onToggleStagedView,
  borderless = false,
}: WorkspaceDiffPanelProps) {
  const diffViewMode = useGitWorkspaceStore((s) => s.diffViewMode);
  const whitespacePolicy = useGitWorkspaceStore((s) => s.whitespacePolicy);
  const setDiffViewMode = useGitWorkspaceStore((s) => s.setDiffViewMode);
  const setWhitespacePolicy = useGitWorkspaceStore((s) => s.setWhitespacePolicy);
  const diff = document ? toFileDiffView(document) : null;
  const monacoOptions = useMemo(
    () => ({
      sideBySide: diffViewMode === "side_by_side",
      trimWhitespace: whitespacePolicy !== "doNotIgnore",
      collapseUnchanged: false,
      softWrap: false,
    }),
    [diffViewMode, whitespacePolicy],
  );
  const { postMessage } = useVsCodeApi();
  const client = useMemo(() => createProtocolClient(postMessage), [postMessage]);
  const handleOpenInEditor = useCallback(() => {
    if (!document || !filePath || !diff || diff.binary) {
      return;
    }
    const preview = {
      relativePath: document.filePath,
      title: document.filePath,
      diff,
      repoId: document.repoId,
    } as const;
    void client.openDiffInEditor(preview).catch(reportDiffOpenError);
  }, [document, filePath, diff, client]);
  const fileIdentity = filePath ? splitWorkspacePath(filePath) : null;
  const [selectedLineKeys, setSelectedLineKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [rangeAnchor, setRangeAnchor] = useState<DiffLineSelection | null>(null);

  useEffect(() => {
    setSelectedLineKeys(new Set());
    setRangeAnchor(null);
  }, [filePath, stagedView, diffViewMode, whitespacePolicy]);

  const toggleLine = (selection: DiffLineSelection, shiftKey: boolean) => {
    const key = lineSelectionKey(selection);
    setSelectedLineKeys((prev) => {
      const next = new Set(prev);
      if (shiftKey && rangeAnchor && rangeAnchor.side === selection.side) {
        const start = Math.min(rangeAnchor.line, selection.line);
        const end = Math.max(rangeAnchor.line, selection.line);
        for (let line = start; line <= end; line += 1) {
          next.add(lineSelectionKey({ side: selection.side, line }));
        }
        return next;
      }
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    if (!shiftKey) {
      setRangeAnchor(selection);
    }
  };

  const hasHunkActions =
    Boolean(showHunkActions) &&
    Boolean(onStageHunk || onUnstageHunk || onShelveHunk) ||
    Boolean(showLogActions && canDropSelected && onDropHunk);

  const hunkPanelProps = {
    whitespacePolicy,
    showHunkActions: hasHunkActions,
    showLineActions: showHunkActions || showLogActions,
    stagedView,
    busy,
    filePath,
    selectedLineKeys,
    onToggleLine: toggleLine,
    onStageLines: onStageLines
      ? (lines: DiffLineSelection[]) => {
        onStageLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onUnstageLines: onUnstageLines
      ? (lines: DiffLineSelection[]) => {
        onUnstageLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onClearLineSelection: () => clearSelection(setSelectedLineKeys, setRangeAnchor),
    onStageHunk,
    onUnstageHunk,
    onShelveHunk,
    showLogActions,
    canDropSelected,
    onDropHunk,
    onCherryPickLines: onCherryPickLines
      ? (lines: DiffLineSelection[]) => {
        onCherryPickLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onRevertLines: onRevertLines
      ? (lines: DiffLineSelection[]) => {
        onRevertLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
    onDropLines: onDropLines
      ? (lines: DiffLineSelection[]) => {
        onDropLines(lines);
        clearSelection(setSelectedLineKeys, setRangeAnchor);
      }
      : undefined,
  };

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col ${borderless ? "" : "border-l border-border"}`}
      data-testid="workspace-diff-panel"
    >
      <div className="shrink-0 flex items-center gap-2 px-2.5 h-header min-h-header border-b border-border bg-tabs-bg">
        {fileIdentity && (
          <span className="min-w-0 flex-1 flex items-baseline gap-2" data-testid="diff-file-identity">
            <span className="truncate text-ui font-semibold">
              {fileIdentity.name}
            </span>
            {fileIdentity.dir ? (
              <span className="truncate text-micro text-vscode-description">
                {fileIdentity.dir}
              </span>
            ) : null}
          </span>
        )}
        {diff && !diff.binary && diff.layout === "split" && (
          <>
            <Button variant="ghost" size="content"
              type="button"
              className="h-6 px-2 text-section rounded-vscode border border-border hover:bg-list-hover"
              onClick={() =>
                setDiffViewMode(
                  diffViewMode === "side_by_side" ? "unified" : "side_by_side",
                )
              }
              data-testid="diff-view-mode-toggle"
            >
              {diffViewMode === "side_by_side" ? "Unified" : "Side-by-side"}
            </Button>
            <SelectField
              className="h-6 px-1 text-section rounded-vscode border border-border bg-input"
              value={whitespacePolicy}
              onChange={(event) =>
                setWhitespacePolicy(event.target.value as WhitespacePolicy)
              }
              data-testid="diff-whitespace-policy"
              aria-label="Whitespace policy"
            >
              {(Object.keys(WHITESPACE_LABELS) as WhitespacePolicy[]).map(
                (policy) => (
                  <option key={policy} value={policy}>
                    {WHITESPACE_LABELS[policy]}
                  </option>
                ),
              )}
            </SelectField>
          </>
        )}
        {showHunkActions && onToggleStagedView && (
          <Button variant="ghost" size="content"
            type="button"
            className="h-6 px-2 text-section rounded-vscode border border-border hover:bg-list-hover"
            onClick={onToggleStagedView}
            data-testid="diff-staged-toggle"
          >
            {stagedView ? "Staged" : "Working tree"}
          </Button>
        )}
        {document && filePath && diff && !diff.binary && (
          <Button variant="ghost" size="content"
            type="button"
            className="h-6 px-2 text-section rounded-vscode border border-border hover:bg-list-hover flex items-center gap-1"
            onClick={handleOpenInEditor}
            data-testid="diff-open-in-editor"
            title="Open in Editor"
            aria-label="Open in Editor"
          >
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
            Open in Editor
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && (
          <div className="p-3 text-ui text-vscode-description">
            Loading diff preview…
          </div>
        )}
        {!loading && error && (
          <div className="p-3 text-ui text-danger-fg">
            {error}
          </div>
        )}
        {!loading && !error && !diff && (
          <div className="p-3 text-ui text-vscode-description">
            Select a changed file to preview its diff.
          </div>
        )}
        {!loading && !error && diff?.binary && (
          <div className="p-3 text-ui text-vscode-description">
            Binary file ({changedFileStatusLabel(diff.status)}) — preview not
            available.
          </div>
        )}
        {!loading && !error && diff && !diff.binary && diff.left && diff.right && (
          <div className="h-full min-h-0 flex flex-col" data-testid="git-diff-preview">
            {diff.layout === "split" && diffViewMode === "unified" && !showLogActions ? (
              <UnifiedWithHunks
                left={diff.left}
                right={diff.right}
                {...hunkPanelProps}
              />
            ) : diff.layout === "split" && showHunkActions ? (
              <SplitWithHunks
                left={diff.left}
                right={diff.right}
                {...hunkPanelProps}
              />
            ) : (
              // History/compare views share the same Monaco renderer as the
              // standalone content tab, so fonts, syntax tokens and diff
              // highlighting stay identical. The hunk renderer remains only
              // where staging actions need line-level controls.
              <MonacoDiffViewer
                leftText={diff.left.text}
                rightText={diff.right.text}
                leftLabel={diff.left.label}
                rightLabel={diff.right.label}
                filePath={filePath}
                options={monacoOptions}
                revealFirstChange={showLogActions}
              />
            )}
          </div>
        )}
        {!loading && !error && diff && !diff.binary && diff.layout === "single" && ((diff.left && !diff.right) || (!diff.left && diff.right)) && (
          <div className="h-full min-h-0 flex flex-col" data-testid="git-diff-preview">
            <MonacoDiffViewer
              leftText={diff.left?.text ?? ""}
              rightText={diff.right?.text ?? ""}
              leftLabel={diff.left?.label ?? "Empty"}
              rightLabel={diff.right?.label ?? "Deleted"}
              filePath={filePath}
              options={monacoOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
