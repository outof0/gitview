import {
  Cherry,
  Copy,
  FileOutput,
  GitBranchPlus,
  Layers,
  MessageSquare,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import type { LogCommitEntry } from "@gitview/shared/types/log";

type WorkspaceLogToolbarProps = {
  branch?: string | null;
  loading: boolean;
  busy: boolean;
  protectedBranch: boolean;
  selected: LogCommitEntry | null;
  selectedShas: string[];
  onRefresh: () => void;
  onUndoLastCommit?: () => void;
  onCopyHash?: (sha: string) => void;
  onCreateBranchFromCommit?: (sha: string) => void;
  onResetToCommit?: (sha: string, mode: "mixed") => void;
  onCherryPickMultiple?: (shas: string[]) => void;
  onCherryPick?: (sha: string) => void;
  onRevertMultiple?: (shas: string[]) => void;
  onRevert?: (sha: string) => void;
  onEditMessage?: (sha: string, subject: string) => void;
  onDropCommit?: (sha: string) => void;
  onExtractChanges?: (sha: string) => void;
  onRewriteCommit?: (sha: string, action: "squash" | "fixup" | "drop") => void;
};

export function WorkspaceLogToolbar({
  branch,
  loading,
  busy,
  protectedBranch,
  selected,
  selectedShas,
  onRefresh,
  onUndoLastCommit,
  onCopyHash,
  onCreateBranchFromCommit,
  onResetToCommit,
  onCherryPickMultiple,
  onCherryPick,
  onRevertMultiple,
  onRevert,
  onEditMessage,
  onDropCommit,
  onExtractChanges,
  onRewriteCommit,
}: WorkspaceLogToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[12px] font-semibold flex-1">Log</span>
      {branch && (
        <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">
          {branch}
        </span>
      )}
      <button
        type="button"
        className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover"
        onClick={onRefresh}
        disabled={loading}
        data-testid="log-refresh"
      >
        Refresh
      </button>
      {onUndoLastCommit && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          title={
            protectedBranch
              ? "Undo last commit is blocked on protected branches"
              : undefined
          }
          onClick={onUndoLastCommit}
          data-testid="log-undo-last-commit"
        >
          <Undo2 size={14} aria-hidden />
          Undo last
        </button>
      )}
      {selected && onCopyHash && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover"
          disabled={busy}
          onClick={() => onCopyHash(selected.sha)}
          data-testid="log-copy-hash"
        >
          <Copy size={14} aria-hidden />
          Copy hash
        </button>
      )}
      {selected && onCreateBranchFromCommit && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onCreateBranchFromCommit(selected.sha)}
          data-testid="log-create-branch"
        >
          <GitBranchPlus size={14} aria-hidden />
          New branch
        </button>
      )}
      {selected && onResetToCommit && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          title={
            protectedBranch
              ? "Reset is blocked on protected branches"
              : undefined
          }
          onClick={() => onResetToCommit(selected.sha, "mixed")}
          data-testid="log-reset"
        >
          <RotateCcw size={14} aria-hidden />
          Reset here
        </button>
      )}
      {selectedShas.length > 1 && onCherryPickMultiple && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onCherryPickMultiple(selectedShas)}
          data-testid="log-cherry-pick-multiple"
        >
          <Cherry size={14} aria-hidden />
          Cherry-pick ({selectedShas.length})
        </button>
      )}
      {selected && onCherryPick && selectedShas.length <= 1 && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={() => onCherryPick(selected.sha)}
          data-testid="log-cherry-pick"
        >
          <Cherry size={14} aria-hidden />
          Cherry-pick
        </button>
      )}
      {selectedShas.length > 1 && onRevertMultiple && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          onClick={() => onRevertMultiple(selectedShas)}
          data-testid="log-revert-multiple"
        >
          <Undo2 size={14} aria-hidden />
          Revert ({selectedShas.length})
        </button>
      )}
      {selected && onRevert && selectedShas.length <= 1 && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          title={
            protectedBranch
              ? "Revert is blocked on protected branches"
              : undefined
          }
          onClick={() => onRevert(selected.sha)}
          data-testid="log-revert"
        >
          <Undo2 size={14} aria-hidden />
          Revert
        </button>
      )}
      {selected && onEditMessage && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          onClick={() => onEditMessage(selected.sha, selected.subject)}
          data-testid="log-edit-message"
        >
          <MessageSquare size={14} aria-hidden />
          Edit message
        </button>
      )}
      {selected && onDropCommit && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          onClick={() => onDropCommit(selected.sha)}
          data-testid="log-drop-commit"
        >
          <Trash2 size={14} aria-hidden />
          Drop
        </button>
      )}
      {selected && onExtractChanges && (
        <button
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy || protectedBranch}
          title={
            protectedBranch
              ? "Extract changes is blocked on protected branches"
              : "Apply commit changes to the working tree without committing"
          }
          onClick={() => onExtractChanges(selected.sha)}
          data-testid="log-extract-changes"
        >
          <FileOutput size={14} aria-hidden />
          Extract changes
        </button>
      )}
      {selected && onRewriteCommit && (
        <>
          <button
            type="button"
            className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
            disabled={busy || protectedBranch}
            onClick={() => onRewriteCommit(selected.sha, "squash")}
            data-testid="log-squash-commit"
          >
            <Layers size={14} aria-hidden />
            Squash
          </button>
          <button
            type="button"
            className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
            disabled={busy || protectedBranch}
            onClick={() => onRewriteCommit(selected.sha, "fixup")}
            data-testid="log-fixup-commit"
          >
            Fixup
          </button>
        </>
      )}
    </div>
  );
}