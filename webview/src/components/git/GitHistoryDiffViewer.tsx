import type { Ref } from "react";
import type { FileDiffView } from "@gitview/types";
import { changedFileStatusLabel } from "./changedFileStatus";
import {
  MonacoDiffViewer,
  type DiffEditorContextMenuEvent,
  type DiffViewerOptions,
  type MonacoDiffViewerHandle,
} from "./MonacoDiffViewer";
import { HighlightedCodeLine } from "./HighlightedCodeLine";
import { cn } from "../../lib/cn";
import type { DiffLineHighlight } from "./buildDiffDisplayRows";

type GitHistoryDiffViewerProps = {
  diff: FileDiffView | null;
  /** Repo-relative path — drives syntax colors per file type. */
  filePath?: string | null;
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  /** Standalone compare panel hides per-pane headers (toolbar shows revisions). */
  variant?: "embedded" | "standalone";
  /** Right-click on a line in the Monaco compare view (Annotate, etc.). */
  onEditorContextMenu?: (event: DiffEditorContextMenuEvent) => void;
  /** Diff viewer toolbar state (side-by-side, whitespace, collapse, wrap). */
  options?: DiffViewerOptions;
  onDiffCountChange?: (count: number) => void;
  viewerRef?: Ref<MonacoDiffViewerHandle>;
};

function highlightClass(side: DiffLineHighlight): string {
  switch (side) {
    case "removed":
      return "nx-hl-removed";
    case "added":
      return "nx-hl-added";
    case "changed":
      return "nx-hl-changed";
    default:
      return "nx-hl-none";
  }
}

/** Whole-file add/delete: single scrollable column (Monaco diff needs two sides). */
function SinglePanel({
  panel,
  side,
  filePath,
}: {
  panel: { label: string; text: string };
  side: "added" | "deleted";
  filePath?: string | null;
}) {
  const lines = panel.text === "" ? [""] : panel.text.split("\n");
  const lineHighlight: DiffLineHighlight =
    side === "added" ? "added" : "removed";

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-vscode-editor-bg">
      <div className="h-7 px-3 flex items-center text-[11px] font-semibold text-vscode-description border-b border-border shrink-0 bg-vscode-editor-bg">
        {panel.label}
        <span className="ml-2 font-normal opacity-80">
          ({side === "added" ? "new file" : "deleted"})
        </span>
      </div>
      <div
        className="m-0 flex-1 overflow-auto font-mono text-[11px] leading-[18px] text-vscode-editor-fg bg-vscode-editor-bg"
        data-testid="git-diff-single-scroll"
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "nx-diff-code-line relative flex whitespace-pre min-h-5",
              highlightClass(lineHighlight),
            )}
          >
            <span className="nx-diff-ln shrink-0 w-[52px] pr-3 text-right text-vscode-line-number select-none">
              {i + 1}
            </span>
            <span className="nx-diff-txt flex-1 min-w-0 py-0 px-2 whitespace-pre overflow-visible">
              <HighlightedCodeLine text={line} filePath={filePath} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GitHistoryDiffViewer({
  diff,
  filePath,
  loading,
  error,
  emptyLabel = "Select a changed file to preview its diff.",
  variant = "embedded",
  onEditorContextMenu,
  options,
  onDiffCountChange,
  viewerRef,
}: GitHistoryDiffViewerProps) {
  const standalone = variant === "standalone";
  if (loading) {
    return (
      <div
        className="p-3 text-[12px] text-vscode-description"
        data-testid="git-diff-preview"
      >
        Loading diff preview…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-3 text-[12px] text-vscode-error"
        data-testid="git-diff-preview"
      >
        {error}
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="p-3 text-[12px] text-vscode-description">
        {emptyLabel}
      </div>
    );
  }

  if (diff.binary) {
    return (
      <div
        className="p-3 text-[12px] text-vscode-description"
        data-testid="git-diff-preview"
      >
        Binary file ({changedFileStatusLabel(diff.status)}) — preview not
        available.
      </div>
    );
  }

  if (diff.layout === "single") {
    const panel = diff.right ?? diff.left;
    if (!panel) {
      return (
        <div className="p-3 text-[12px] text-vscode-description">
          No content to display.
        </div>
      );
    }
    // Prefer Monaco side-by-side with empty opposite for A/D when possible
    if (diff.status === "A" && diff.right) {
      return (
        <div
          className="h-full min-h-0 flex flex-col"
          data-testid="git-diff-preview"
        >
          <MonacoDiffViewer
            leftText=""
            rightText={diff.right.text}
            leftLabel="Empty"
            rightLabel={diff.right.label}
            filePath={filePath}
            hideHeaders={standalone}
            onEditorContextMenu={onEditorContextMenu}
            options={options}
            onDiffCountChange={onDiffCountChange}
            handleRef={viewerRef}
          />
        </div>
      );
    }
    if (diff.status === "D" && diff.left) {
      return (
        <div
          className="h-full min-h-0 flex flex-col"
          data-testid="git-diff-preview"
        >
          <MonacoDiffViewer
            leftText={diff.left.text}
            rightText=""
            leftLabel={diff.left.label}
            rightLabel="Deleted"
            filePath={filePath}
            hideHeaders={standalone}
            onEditorContextMenu={onEditorContextMenu}
            options={options}
            onDiffCountChange={onDiffCountChange}
            handleRef={viewerRef}
          />
        </div>
      );
    }
    return (
      <div
        className="h-full min-h-0 flex flex-col"
        data-testid="git-diff-preview"
      >
        <SinglePanel
          panel={panel}
          side={diff.status === "D" ? "deleted" : "added"}
          filePath={filePath}
        />
      </div>
    );
  }

  if (!diff.left || !diff.right) {
    return (
      <div className="p-3 text-[12px] text-vscode-description">
        Could not load both revisions for comparison.
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col"
      data-testid="git-diff-preview"
    >
      <MonacoDiffViewer
        leftText={diff.left.text}
        rightText={diff.right.text}
        leftLabel={diff.left.label}
        rightLabel={diff.right.label}
        filePath={filePath}
        hideHeaders={standalone}
        onEditorContextMenu={onEditorContextMenu}
        options={options}
        onDiffCountChange={onDiffCountChange}
        handleRef={viewerRef}
      />
    </div>
  );
}
