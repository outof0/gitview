import { Button } from "../../ui/Button";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpFromLine,
  GitBranch,
  GitCompare,
  GitMerge,
  History,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import { MenuDivider, MenuItem, MenuSectionHeader } from "../../ui/MenuItem";
import { checkoutRef } from "./checkoutRef";

export type BranchRowProps = {
  branch: BranchEntry;
  busy: boolean;
  smartCheckout: boolean;
  forceCheckout: boolean;
  onCheckout: (ref: string, opts?: { smart?: boolean; force?: boolean }) => void;
  onRequestForceCheckout?: (
    ref: string,
    opts?: { smart?: boolean },
  ) => void;
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

const ICON = { size: 14, strokeWidth: 1.75, "aria-hidden": true as const };

export function BranchRow({
  branch,
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
}: BranchRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const label = branch.remote ? branch.fullName : branch.name;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleCheckout = () => {
    const ref = checkoutRef(branch);
    const opts = { smart: smartCheckout, force: forceCheckout };
    if (forceCheckout && onRequestForceCheckout) {
      onRequestForceCheckout(ref, opts);
      return;
    }
    onCheckout(ref, opts);
  };

  // Decide which items would actually render before deciding which section
  // headers to show. A header with no items below it is just a label that
  // looks like a button — clicking it does nothing, which surprised a user
  // enough to report it as a bug. Hide the header when its section is empty.
  const showCheckout = !branch.current;
  const showShowInLog = Boolean(onShowInLog);
  const showCompareWithCurrent = Boolean(onCompareWithCurrent) && !branch.current;
  const showCompareWithWorkingTree = Boolean(onCompareWithWorkingTree);
  const showMergeIntoCurrent = Boolean(onMergeIntoCurrent) && !branch.current;
  const showRebaseOnto = Boolean(onRebaseOnto) && !branch.current;
  const showFavorite = Boolean(onFavorite) && !branch.remote;
  const showRename = Boolean(onRename) && !branch.remote;
  const showPush = Boolean(onPush) && !branch.remote;
  const showDelete = Boolean(onDelete) && !branch.remote && !branch.current;

  const hasBranchItems = showCheckout || showShowInLog;
  const hasCompareItems = showCompareWithCurrent || showCompareWithWorkingTree;
  const hasIntegrateItems = showMergeIntoCurrent || showRebaseOnto;
  const hasManageItems = showRename || showPush || showDelete;
  // If the menu would be empty, the kebab is a no-op. Disable rather than
  // hide so the row layout stays stable (no jitter when a section's
  // conditional items flip on and off between branches).
  const hasAnyMenuItem =
    hasBranchItems || hasCompareItems || hasIntegrateItems || showFavorite || hasManageItems;

  return (
    <div
      className={`flex items-center gap-0.5 h-row min-h-row px-0.5 ${
        branch.current ? "font-semibold" : ""
      }`}
      data-testid={`branch-row-${branch.fullName}`}
    >
      <Button variant="ghost" size="content"
        type="button"
        className="flex-1 text-left h-full px-2 text-ui leading-row hover:bg-list-hover disabled:opacity-40 rounded-[var(--nx-menu-radius)] truncate"
        disabled={branch.current || busy}
        onClick={handleCheckout}
        data-testid={`branch-${branch.fullName}`}
      >
        {branch.favorite && (
          <Star
            size={12}
            className="inline mr-1 text-vscode-link align-middle"
            aria-label="Favorite"
            fill="currentColor"
          />
        )}
        {label}
        {branch.protected && (
          <ShieldAlert
            size={12}
            className="inline ml-1.5 opacity-70 align-middle"
            aria-label="Protected branch"
          />
        )}
        {branch.current && (
          <span className="ml-1.5 text-section opacity-70">
            current
          </span>
        )}
      </Button>
      <div className="relative" ref={menuRef}>
        <Button variant="ghost" size="content"
          type="button"
          className="h-row w-row flex items-center justify-center rounded-[var(--nx-menu-radius)] hover:bg-list-hover disabled:opacity-40"
          disabled={busy || !hasAnyMenuItem}
          aria-label={`Actions for ${label}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          data-testid={`branch-menu-${branch.fullName}`}
        >
          <MoreHorizontal size={14} aria-hidden />
        </Button>
        {menuOpen && (
          <div
            role="menu"
            className="nx-context-menu absolute right-0 top-full z-20 min-w-branch-menu py-1 border border-menu-border bg-menu-bg shadow-2xl"
            style={{ borderRadius: "var(--nx-menu-radius)" }}
            data-testid={`branch-menu-panel-${branch.fullName}`}
          >
            {hasBranchItems && (
              <>
                <MenuSectionHeader label="Branch" />
                {showCheckout && (
                  <MenuItem
                    label="Checkout"
                    onClick={() => {
                      setMenuOpen(false);
                      handleCheckout();
                    }}
                    icon={<GitBranch {...ICON} />}
                  />
                )}
                {showShowInLog && (
                  <MenuItem
                    label="Show in Log"
                    testId={`branch-show-in-log-${branch.fullName}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onShowInLog?.(branch);
                    }}
                    icon={<History {...ICON} />}
                  />
                )}
              </>
            )}

            {hasCompareItems && (
              <>
                <MenuDivider />
                <MenuSectionHeader label="Compare" />
                {showCompareWithCurrent && (
                  <MenuItem
                    label="Compare with Current"
                    testId={`branch-compare-current-${branch.fullName}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onCompareWithCurrent?.(branch);
                    }}
                    icon={<GitCompare {...ICON} />}
                  />
                )}
                {showCompareWithWorkingTree && (
                  <MenuItem
                    label="Compare with Working Tree"
                    testId={`branch-compare-working-tree-${branch.fullName}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onCompareWithWorkingTree?.(branch);
                    }}
                    icon={<GitCompare {...ICON} />}
                  />
                )}
              </>
            )}

            {hasIntegrateItems && (
              <>
                <MenuDivider />
                <MenuSectionHeader label="Integrate" />
                {showMergeIntoCurrent && (
                  <MenuItem
                    label="Merge into Current"
                    testId={`branch-merge-${branch.fullName}`}
                    disabled={branch.protected}
                    disabledReason="Protected branch"
                    onClick={() => {
                      setMenuOpen(false);
                      onMergeIntoCurrent?.(branch);
                    }}
                    icon={<GitMerge {...ICON} />}
                  />
                )}
                {showRebaseOnto && (
                  <MenuItem
                    label="Rebase onto"
                    testId={`branch-rebase-onto-${branch.fullName}`}
                    disabled={branch.protected}
                    disabledReason="Protected branch"
                    onClick={() => {
                      setMenuOpen(false);
                      onRebaseOnto?.(branch);
                    }}
                    icon={<GitMerge {...ICON} />}
                  />
                )}
              </>
            )}

            {showFavorite && (
              <>
                <MenuDivider />
                <MenuItem
                  label={branch.favorite ? "Remove favorite" : "Favorite"}
                  testId={`branch-favorite-${branch.fullName}`}
                  onClick={() => {
                    setMenuOpen(false);
                    onFavorite?.(branch);
                  }}
                  icon={
                    <Star
                      {...ICON}
                      fill={branch.favorite ? "currentColor" : "none"}
                    />
                  }
                />
              </>
            )}

            {hasManageItems && (
              <>
                <MenuDivider />
                <MenuSectionHeader label="Manage" />
                {showRename && (
                  <MenuItem
                    label="Rename"
                    testId={`branch-rename-${branch.fullName}`}
                    disabled={branch.protected}
                    disabledReason="Protected branch"
                    onClick={() => {
                      setMenuOpen(false);
                      onRename?.(branch);
                    }}
                    icon={<Pencil {...ICON} />}
                  />
                )}
                {showPush && (
                  <MenuItem
                    label="Push"
                    testId={`branch-push-${branch.fullName}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onPush?.(branch);
                    }}
                    icon={<ArrowUpFromLine {...ICON} />}
                  />
                )}
                {showDelete && (
                  <MenuItem
                    label="Delete"
                    testId={`branch-delete-${branch.fullName}`}
                    disabled={branch.protected}
                    disabledReason="Protected branch"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete?.(branch);
                    }}
                    icon={<Trash2 {...ICON} />}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
