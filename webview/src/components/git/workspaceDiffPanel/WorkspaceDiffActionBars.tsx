import { Archive, Cherry, Minus, Plus, Trash2, Undo2 } from "lucide-react";

export function LineActionBar({
  count,
  showStage,
  showUnstage,
  showLogActions,
  canDropSelected,
  busy,
  onStage,
  onUnstage,
  onCherryPick,
  onRevert,
  onDrop,
  onClear,
}: {
  count: number;
  showStage: boolean;
  showUnstage: boolean;
  showLogActions?: boolean;
  canDropSelected?: boolean;
  busy?: boolean;
  onStage?: () => void;
  onUnstage?: () => void;
  onCherryPick?: () => void;
  onRevert?: () => void;
  onDrop?: () => void;
  onClear?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1 border-b border-border bg-[var(--vscode-editor-background)]"
      data-testid="line-actions-bar"
    >
      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
        {count} line{count === 1 ? "" : "s"} selected
      </span>
      {showStage && onStage && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onStage}
          data-testid="stage-lines"
        >
          <Plus size={12} aria-hidden />
          Stage lines
        </button>
      )}
      {showUnstage && onUnstage && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onUnstage}
          data-testid="unstage-lines"
        >
          <Minus size={12} aria-hidden />
          Unstage lines
        </button>
      )}
      {showLogActions && onCherryPick && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onCherryPick}
          data-testid="cherry-pick-lines"
        >
          <Cherry size={12} aria-hidden />
          Cherry-pick lines
        </button>
      )}
      {showLogActions && onRevert && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onRevert}
          data-testid="revert-lines"
        >
          <Undo2 size={12} aria-hidden />
          Revert lines
        </button>
      )}
      {showLogActions && canDropSelected && onDrop && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onDrop}
          data-testid="drop-lines"
        >
          <Trash2 size={12} aria-hidden />
          Drop lines
        </button>
      )}
      {onClear && (
        <button
          type="button"
          className="h-6 px-2 text-[10px] rounded-vscode hover:bg-list-hover"
          onClick={onClear}
          data-testid="clear-line-selection"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function HunkActionBar({
  hunkId,
  showStage,
  showUnstage,
  showLogActions,
  canDropSelected,
  busy,
  onStage,
  onUnstage,
  onShelve,
  onCherryPick,
  onRevert,
  onDrop,
}: {
  hunkId: number;
  showStage: boolean;
  showUnstage: boolean;
  showLogActions?: boolean;
  canDropSelected?: boolean;
  busy?: boolean;
  onStage?: (hunkId: number) => void;
  onUnstage?: (hunkId: number) => void;
  onShelve?: (hunkId: number) => void;
  onCherryPick?: (hunkId: number) => void;
  onRevert?: (hunkId: number) => void;
  onDrop?: (hunkId: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 bg-[var(--vscode-editor-background)] border-y border-border"
      data-testid={`hunk-actions-${hunkId}`}
    >
      {showStage && onStage && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onStage(hunkId)}
          data-testid={`stage-hunk-${hunkId}`}
        >
          <Plus size={12} aria-hidden />
          Stage hunk
        </button>
      )}
      {showUnstage && onUnstage && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onUnstage(hunkId)}
          data-testid={`unstage-hunk-${hunkId}`}
        >
          <Minus size={12} aria-hidden />
          Unstage hunk
        </button>
      )}
      {onShelve && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onShelve(hunkId)}
          data-testid={`shelve-hunk-${hunkId}`}
        >
          <Archive size={12} aria-hidden />
          Shelve hunk
        </button>
      )}
      {showLogActions && onCherryPick && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onCherryPick(hunkId)}
          data-testid={`cherry-pick-hunk-${hunkId}`}
        >
          <Cherry size={12} aria-hidden />
          Cherry-pick hunk
        </button>
      )}
      {showLogActions && onRevert && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onRevert(hunkId)}
          data-testid={`revert-hunk-${hunkId}`}
        >
          <Undo2 size={12} aria-hidden />
          Revert hunk
        </button>
      )}
      {showLogActions && canDropSelected && onDrop && (
        <button
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-[10px] rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onDrop(hunkId)}
          data-testid={`drop-hunk-${hunkId}`}
        >
          <Trash2 size={12} aria-hidden />
          Drop hunk
        </button>
      )}
    </div>
  );
}
