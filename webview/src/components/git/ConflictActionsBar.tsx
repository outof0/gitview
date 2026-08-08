import { ArrowLeft, ArrowRight, GitMerge, Wand2 } from "lucide-react";

type ConflictActionsBarProps = {
  filePath: string;
  busy?: boolean;
  onAcceptLocal: () => void;
  onAcceptIncoming: () => void;
  onOpenMerge: () => void;
  onApplyNonConflicting?: () => void;
};

export function ConflictActionsBar({
  filePath,
  busy = false,
  onAcceptLocal,
  onAcceptIncoming,
  onOpenMerge,
  onApplyNonConflicting,
}: ConflictActionsBarProps) {
  return (
    <div
      className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-editorWarning-border,var(--vscode-editorWarning-foreground,rgba(224,175,83,0.3)))] bg-[var(--vscode-editorWarning-background,rgba(224,175,83,0.1))] text-[var(--vscode-editorWarning-foreground,#e0ad53)]"
      data-testid="conflict-actions-bar"
    >
      <span className="text-[11px] font-mono truncate flex-1" title={filePath}>
        Merge conflict: {filePath}
      </span>
      <button
        type="button"
        className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
        disabled={busy}
        onClick={onAcceptLocal}
        data-testid="conflict-accept-local"
      >
        <ArrowLeft size={14} aria-hidden />
        Accept Local
      </button>
      <button
        type="button"
        className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
        disabled={busy}
        onClick={onAcceptIncoming}
        data-testid="conflict-accept-incoming"
      >
        <ArrowRight size={14} aria-hidden />
        Accept Incoming
      </button>
      {onApplyNonConflicting && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onApplyNonConflicting}
          data-testid="conflict-apply-non-conflicting"
        >
          <Wand2 size={14} aria-hidden />
          Apply non-conflicting
        </button>
      )}
      <button
        type="button"
        className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
        disabled={busy}
        onClick={onOpenMerge}
        data-testid="conflict-open-merge"
      >
        <GitMerge size={14} aria-hidden />
        Merge Studio
      </button>
    </div>
  );
}