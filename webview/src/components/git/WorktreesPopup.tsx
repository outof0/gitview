import { useState } from "react";
import { FolderTree, X } from "lucide-react";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";

type WorktreesPopupProps = {
  open: boolean;
  snapshot: WorktreeListSnapshot | null;
  loading?: boolean;
  busy?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onAdd: (path: string, opts?: { branch?: string; newBranch?: string }) => void;
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
};

export function WorktreesPopup({
  open,
  snapshot,
  loading = false,
  busy = false,
  onClose,
  onRefresh,
  onAdd,
  onOpen,
  onRemove,
}: WorktreesPopupProps) {
  const [newPath, setNewPath] = useState("");
  const [newBranch, setNewBranch] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40"
      data-testid="worktrees-popup"
      onClick={onClose}
    >
      <div
        className="w-[min(520px,94vw)] max-h-[75vh] flex flex-col rounded-vscode border border-border bg-[var(--vscode-editor-background)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <FolderTree size={16} aria-hidden />
          <span className="text-[13px] font-semibold flex-1">Worktrees</span>
          <button
            type="button"
            className="h-7 px-2 text-[11px] rounded-vscode hover:bg-list-hover"
            onClick={onRefresh}
            disabled={loading || busy}
          >
            Refresh
          </button>
          <button type="button" className="h-7 w-7 flex items-center justify-center rounded-vscode hover:bg-list-hover" onClick={onClose}>
            <X size={14} aria-hidden />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto" data-testid="worktrees-list">
          {loading && (
            <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
              Loading worktrees…
            </div>
          )}
          {!loading &&
            (snapshot?.worktrees ?? []).map((entry) => (
              <div
                key={entry.path}
                className="flex items-center gap-2 px-3 py-2 border-b border-border text-[12px]"
                data-testid={`worktree-${entry.isMain ? "main" : entry.path}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate">{entry.path}</div>
                  <div className="text-[11px] text-[var(--vscode-descriptionForeground)] truncate">
                    {entry.branch ?? (entry.detached ? "detached" : "unknown")}
                    {entry.isMain ? " · main" : ""}
                    {entry.locked ? " · locked" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
                  disabled={busy}
                  onClick={() => onOpen(entry.path)}
                >
                  Open
                </button>
                {!entry.isMain && (
                  <button
                    type="button"
                    className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
                    disabled={busy}
                    onClick={() => onRemove(entry.path)}
                    data-testid={`worktree-remove-${entry.path}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
        </div>

        <div className="shrink-0 flex flex-col gap-2 px-3 py-2 border-t border-border">
          <input
            type="text"
            className="h-7 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
            placeholder="Worktree path"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            data-testid="new-worktree-path"
          />
          <input
            type="text"
            className="h-7 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
            placeholder="New branch name (optional)"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            data-testid="new-worktree-branch"
          />
          <button
            type="button"
            className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40 self-end"
            disabled={!newPath.trim() || busy}
            onClick={() => {
              onAdd(newPath.trim(), newBranch.trim() ? { newBranch: newBranch.trim() } : undefined);
              setNewPath("");
              setNewBranch("");
            }}
            data-testid="add-worktree-button"
          >
            Add worktree
          </button>
        </div>
      </div>
    </div>
  );
}