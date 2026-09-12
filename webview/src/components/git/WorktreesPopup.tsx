import {
  useState,
} from "react";
import {
  FolderTree,
  X,
} from "lucide-react";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";
import { GitDialogShell } from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { ToolbarIconButton } from "../ui/ToolbarControls";
import { ToolEmptyState } from "../ui/ToolEmptyState";

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

  return (
    <GitDialogShell
      open={open}
      title="Worktrees"
      titleIcon={<FolderTree size={16} />}
      size="list"
      onCancel={onClose}
      testId="worktrees-popup"
      headerActions={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onRefresh}
            disabled={loading || busy}
          >
            Refresh
          </Button>
          <ToolbarIconButton onClick={onClose} aria-label="Close worktrees">
            <X size={14} aria-hidden />
          </ToolbarIconButton>
        </>
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          <TextField
            size="compact"
            containerClassName="w-full"
            placeholder="Worktree path"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            data-testid="new-worktree-path"
          />
          <TextField
            size="compact"
            containerClassName="w-full"
            placeholder="New branch name (optional)"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            data-testid="new-worktree-branch"
          />
          <Button
            type="button"
            variant="primary" size="compact" className="self-end"
            disabled={!newPath.trim() || busy}
            onClick={() => {
              onAdd(
                newPath.trim(),
                newBranch.trim() ? { newBranch: newBranch.trim() } : undefined,
              );
              setNewPath("");
              setNewBranch("");
            }}
            data-testid="add-worktree-button"
          >
            Add worktree
          </Button>
        </div>
      }
    >
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        data-testid="worktrees-list"
      >
        {loading && (
          <div className="p-3 text-ui-sm text-vscode-description">
            Loading worktrees…
          </div>
        )}
        {!loading && (snapshot?.worktrees ?? []).length === 0 && (
          <ToolEmptyState title="No worktrees yet." />
        )}
        {!loading &&
          (snapshot?.worktrees ?? []).map((entry) => (
            <div
              key={entry.path}
              className="flex items-center gap-2 px-3 py-2 border-b border-border text-ui"
              data-testid={`worktree-${entry.isMain ? "main" : entry.path}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono truncate">{entry.path}</div>
                <div className="text-ui-sm text-vscode-description truncate">
                  {entry.branch ?? (entry.detached ? "detached" : "unknown")}
                  {entry.isMain ? " · main" : ""}
                  {entry.locked ? " · locked" : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary" size="compact"
                disabled={busy}
                onClick={() => onOpen(entry.path)}
              >
                Open
              </Button>
              {!entry.isMain && (
                <Button
                  type="button"
                  variant="secondary" size="compact"
                  disabled={busy}
                  onClick={() => onRemove(entry.path)}
                  data-testid={`worktree-remove-${entry.path}`}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
      </div>
    </GitDialogShell>
  );
}
