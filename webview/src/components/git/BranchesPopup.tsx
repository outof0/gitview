import { useMemo, useState } from "react";
import { GitBranch, Plus, X } from "lucide-react";
import type { BranchEntry, BranchListSnapshot } from "@gitview/shared/types/branch";
import { BranchRow } from "./branchesPopup/BranchRow";

type BranchesPopupProps = {
  open: boolean;
  snapshot: BranchListSnapshot | null;
  loading?: boolean;
  busy?: boolean;
  onClose: () => void;
  onCheckout: (ref: string, opts?: { smart?: boolean; force?: boolean }) => void;
  onRequestForceCheckout?: (ref: string, opts?: { smart?: boolean }) => void;
  onCreate: (name: string) => void;
  onRefresh: () => void;
  onRename?: (branch: BranchEntry) => void;
  onDelete?: (branch: BranchEntry) => void;
  onPush?: (branch: BranchEntry) => void;
  onFavorite?: (branch: BranchEntry) => void;
  onShowInLog?: (branch: BranchEntry) => void;
  onCompareWithCurrent?: (branch: BranchEntry) => void;
  onCompareWithWorkingTree?: (branch: BranchEntry) => void;
  onMergeIntoCurrent?: (branch: BranchEntry) => void;
  onRebaseOnto?: (branch: BranchEntry) => void;
};

export function BranchesPopup({
  open,
  snapshot,
  loading = false,
  busy = false,
  onClose,
  onCheckout,
  onCreate,
  onRefresh,
  onRequestForceCheckout,
  onRename,
  onDelete,
  onPush,
  onFavorite,
  onShowInLog,
  onCompareWithCurrent,
  onCompareWithWorkingTree,
  onMergeIntoCurrent,
  onRebaseOnto,
}: BranchesPopupProps) {
  const [filter, setFilter] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [smartCheckout, setSmartCheckout] = useState(true);
  const [forceCheckout, setForceCheckout] = useState(false);

  const { favorites, local, remote } = useMemo(() => {
    const branches = snapshot?.branches ?? [];
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? branches.filter((b) => b.fullName.toLowerCase().includes(needle))
      : branches;
    const localBranches = filtered.filter((b) => !b.remote);
    const remoteBranches = filtered.filter((b) => b.remote);
    return {
      favorites: localBranches.filter((b) => b.favorite),
      local: localBranches.filter((b) => !b.favorite),
      remote: remoteBranches,
    };
  }, [filter, snapshot?.branches]);

  if (!open) {
    return null;
  }

  const rowProps = {
    busy,
    smartCheckout,
    forceCheckout,
    onCheckout,
    onRequestForceCheckout,
    onRename,
    onDelete,
    onPush,
    onFavorite,
    onShowInLog,
    onCompareWithCurrent,
    onCompareWithWorkingTree,
    onMergeIntoCurrent,
    onRebaseOnto,
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-12 bg-black/40"
      data-testid="branches-popup"
      onClick={onClose}
    >
      <div
        className="w-[min(420px,92vw)] max-h-[70vh] flex flex-col rounded-vscode border border-border bg-[var(--vscode-editor-background)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <GitBranch size={16} aria-hidden />
          <span className="text-[13px] font-semibold flex-1">Branches</span>
          <button
            type="button"
            className="h-7 px-2 text-[11px] rounded-vscode hover:bg-list-hover"
            onClick={onRefresh}
            disabled={loading || busy}
            data-testid="branches-refresh"
          >
            Refresh
          </button>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded-vscode hover:bg-list-hover"
            onClick={onClose}
            aria-label="Close branches"
          >
            <X size={14} aria-hidden />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-border">
          <input
            type="search"
            className="w-full h-7 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]"
            placeholder="Filter branches…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            data-testid="branches-filter"
          />
          <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
            <input
              type="checkbox"
              checked={smartCheckout}
              onChange={(e) => setSmartCheckout(e.target.checked)}
              data-testid="smart-checkout-toggle"
            />
            Smart Checkout (stash &amp; restore local changes)
          </label>
          <label className="mt-1 flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
            <input
              type="checkbox"
              checked={forceCheckout}
              onChange={(e) => setForceCheckout(e.target.checked)}
              data-testid="force-checkout-toggle"
            />
            Force checkout (discard conflicting local changes)
          </label>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
              Loading branches…
            </div>
          )}

          {!loading && favorites.length > 0 && (
            <section data-testid="branches-favorites">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Favorites
              </div>
              {favorites.map((branch) => (
                <BranchRow key={branch.fullName} branch={branch} {...rowProps} />
              ))}
            </section>
          )}

          {!loading && local.length > 0 && (
            <section data-testid="branches-local">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Local
              </div>
              {local.map((branch) => (
                <BranchRow key={branch.fullName} branch={branch} {...rowProps} />
              ))}
            </section>
          )}

          {!loading && remote.length > 0 && (
            <section data-testid="branches-remote">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Remote
              </div>
              {remote.map((branch) => (
                <BranchRow key={branch.fullName} branch={branch} {...rowProps} />
              ))}
            </section>
          )}

          {!loading && favorites.length === 0 && local.length === 0 && remote.length === 0 && (
            <div className="p-3 text-[12px] text-[var(--vscode-descriptionForeground)]">
              No branches match your filter.
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-border">
          <input
            type="text"
            className="flex-1 h-7 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
            placeholder="New branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            data-testid="new-branch-input"
          />
          <button
            type="button"
            className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
            disabled={!newBranchName.trim() || busy}
            onClick={() => {
              onCreate(newBranchName.trim());
              setNewBranchName("");
            }}
            data-testid="create-branch-button"
          >
            <Plus size={14} aria-hidden />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}