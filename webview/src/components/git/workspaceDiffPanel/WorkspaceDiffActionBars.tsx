import { Button } from "../../ui/Button";
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
      className="flex items-center gap-2 px-3 py-1 border-b border-border bg-vscode-editor-bg"
      data-testid="line-actions-bar"
    >
      <span className="text-section text-vscode-description">
        {count} line{count === 1 ? "" : "s"} selected
      </span>
      {showStage && onStage && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onStage}
          data-testid="stage-lines"
        >
          <Plus size={12} aria-hidden />
          Stage lines
        </Button>
      )}
      {showUnstage && onUnstage && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onUnstage}
          data-testid="unstage-lines"
        >
          <Minus size={12} aria-hidden />
          Unstage lines
        </Button>
      )}
      {showLogActions && onCherryPick && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onCherryPick}
          data-testid="cherry-pick-lines"
        >
          <Cherry size={12} aria-hidden />
          Cherry-pick lines
        </Button>
      )}
      {showLogActions && onRevert && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onRevert}
          data-testid="revert-lines"
        >
          <Undo2 size={12} aria-hidden />
          Revert lines
        </Button>
      )}
      {showLogActions && canDropSelected && onDrop && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onDrop}
          data-testid="drop-lines"
        >
          <Trash2 size={12} aria-hidden />
          Drop lines
        </Button>
      )}
      {onClear && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 text-section rounded-vscode hover:bg-list-hover"
          onClick={onClear}
          data-testid="clear-line-selection"
        >
          Clear
        </Button>
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
  onDrop?: (hunkId: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 bg-vscode-editor-bg border-y border-border"
      data-testid={`hunk-actions-${hunkId}`}
    >
      {showStage && onStage && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onStage(hunkId)}
          data-testid={`stage-hunk-${hunkId}`}
        >
          <Plus size={12} aria-hidden />
          Stage hunk
        </Button>
      )}
      {showUnstage && onUnstage && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onUnstage(hunkId)}
          data-testid={`unstage-hunk-${hunkId}`}
        >
          <Minus size={12} aria-hidden />
          Unstage hunk
        </Button>
      )}
      {onShelve && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onShelve(hunkId)}
          data-testid={`shelve-hunk-${hunkId}`}
        >
          <Archive size={12} aria-hidden />
          Shelve hunk
        </Button>
      )}
      {showLogActions && canDropSelected && onDrop && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-6 px-2 flex items-center gap-1 text-section rounded-vscode hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onDrop(hunkId)}
          data-testid={`drop-hunk-${hunkId}`}
        >
          <Trash2 size={12} aria-hidden />
          Drop hunk
        </Button>
      )}
    </div>
  );
}
