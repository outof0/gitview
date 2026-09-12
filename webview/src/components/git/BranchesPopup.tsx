import {
  useMemo,
  useState,
} from "react";
import { Plus } from "lucide-react";
import type {
  BranchEntry,
  BranchListSnapshot,
} from "@gitview/shared/types/branch";
import { validateBranchName } from "@gitview/shared/lib/branchName";
import { BranchRow } from "./branchesPopup/BranchRow";
import { MenuSectionHeader } from "../ui/MenuItem";
import { Checkbox } from "../ui/Checkbox";
import { TextField } from "../ui/TextField";
import {
  GitDialogShell,
  gitDialogError,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";

type BranchesPopupProps = {
  open: boolean;
  snapshot: BranchListSnapshot | null;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onCheckout: (
    ref: string,
    opts?: { smart?: boolean; force?: boolean },
  ) => void;
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
  /** Editor-area webview: skip the dim overlay so the tab is not a nested modal. */
  embedded?: boolean;
};

export function BranchesPopup({
  open,
  snapshot,
  loading = false,
  busy = false,
  error = null,
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
  embedded = false,
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

  const trimmedNew = newBranchName.trim();
  const newNameError = trimmedNew ? validateBranchName(trimmedNew) : undefined;
  const canCreate = Boolean(trimmedNew) && !newNameError && !busy;

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
    <GitDialogShell
      open={open}
      title="Branches"
      testId="branches-popup"
      size="list"
      variant={embedded ? "embedded" : "modal"}
      onCancel={onClose}
      headerActions={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onRefresh}
            disabled={loading || busy}
            data-testid="branches-refresh"
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onClose}
            aria-label="Close branches"
          >
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 min-h-0 flex-1 overflow-hidden">
        <TextField
          type="search"
          size="compact"
          containerClassName="w-full"
          aria-label="Filter branches"
          placeholder="Filter branches…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="branches-filter"
        />
        <Checkbox
          checked={smartCheckout}
          onChange={setSmartCheckout}
          testId="smart-checkout-toggle"
        >
          Smart Checkout (stash &amp; restore local changes)
        </Checkbox>
        <Checkbox
          checked={forceCheckout}
          onChange={setForceCheckout}
          testId="force-checkout-toggle"
        >
          Force checkout (discard conflicting local changes)
        </Checkbox>
        <div className="flex items-center gap-1.5">
          <TextField
            size="compact"
            containerClassName="flex-1"
            placeholder="New branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                onCreate(trimmedNew);
                setNewBranchName("");
              }
            }}
            data-testid="new-branch-input"
          />
          <Button
            type="button"
            variant="primary" size="compact" className="gap-1 shrink-0"
            disabled={!canCreate}
            onClick={() => {
              onCreate(trimmedNew);
              setNewBranchName("");
            }}
            data-testid="create-branch-button"
          >
            <Plus size={14} aria-hidden />
            Create
          </Button>
        </div>
        {newNameError ? <p className={gitDialogError}>{newNameError}</p> : null}

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1">
          {loading && (
            <div className="p-2 text-vscode-description">Loading branches…</div>
          )}

          {!loading && favorites.length > 0 && (
            <section data-testid="branches-favorites">
              <MenuSectionHeader label="Favorites" />
              {favorites.map((branch) => (
                <BranchRow
                  key={branch.fullName}
                  branch={branch}
                  {...rowProps}
                />
              ))}
            </section>
          )}

          {!loading && local.length > 0 && (
            <section data-testid="branches-local">
              <MenuSectionHeader label="Local" />
              {local.map((branch) => (
                <BranchRow
                  key={branch.fullName}
                  branch={branch}
                  {...rowProps}
                />
              ))}
            </section>
          )}

          {!loading && remote.length > 0 && (
            <section data-testid="branches-remote">
              <MenuSectionHeader label="Remote" />
              {remote.map((branch) => (
                <BranchRow
                  key={branch.fullName}
                  branch={branch}
                  {...rowProps}
                />
              ))}
            </section>
          )}

          {!loading &&
            favorites.length === 0 &&
            local.length === 0 &&
            remote.length === 0 &&
            !error && (
              <div className="p-2 text-vscode-description">
                No branches match your filter.
              </div>
            )}

          {!loading && error && (
            <div
              className="p-2 text-danger-fg"
              data-testid="branches-error"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </GitDialogShell>
  );
}
