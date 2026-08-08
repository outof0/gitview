import { useState } from "react";
import { GitBranch, Package } from "lucide-react";
import type { StashEntry } from "@gitview/shared/types/stash";
import { ContextMenu, type ContextMenuState } from "../../ui/ContextMenu";
import { MenuItem } from "../../ui/MenuItem";
import { cn } from "../../../lib/cn";

type StashListProps = {
  stashes: StashEntry[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  busy?: boolean;
  onView?: (index: number) => void;
  onApply?: (index: number) => void;
  onPop?: (index: number) => void;
  onDrop?: (index: number) => void;
  /** File count for the selected stash; loaded lazily, so only that row shows it. */
  selectedFileCount?: number | null;
  emptyLabel?: string;
};

export function StashList({
  stashes,
  selectedIndex,
  onSelect,
  busy = false,
  onView,
  onApply,
  onPop,
  onDrop,
  selectedFileCount,
  emptyLabel = "No stashes.",
}: StashListProps) {
  const [menu, setMenu] = useState<ContextMenuState>(null);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);

  const openMenu = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(index);
    setMenuIndex(index);
    setMenu({ visible: true, x: event.clientX, y: event.clientY });
  };

  const runFromMenu = (action?: (index: number) => void) => {
    const index = menuIndex;
    setMenu(null);
    if (action && index !== null) {
      action(index);
    }
  };

  if (stashes.length === 0) {
    return (
      <div
        className="px-1.5 py-2 text-[length:var(--nx-font-size-ui)] text-vscode-description"
        data-testid="stash-empty"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <ul
        className="m-0 p-0 list-none overflow-y-auto h-full"
        data-testid="stash-list"
        role="listbox"
        aria-label="Stashes"
      >
        {stashes.map((entry) => {
          const selected = entry.index === selectedIndex;
          const fileCount = selected ? selectedFileCount : entry.fileCount;
          return (
            <li key={entry.ref} className="list-none">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(entry.index)}
                onContextMenu={(event) => openMenu(event, entry.index)}
                onDoubleClick={() => onView?.(entry.index)}
                className={cn(
                  "w-full text-left border-0 bg-transparent cursor-pointer",
                  "flex items-center gap-1.5 px-1.5",
                  "min-h-[var(--nx-row-h)] py-0.5",
                  "text-[length:var(--nx-font-size-ui)]",
                  "border-b border-border",
                  selected
                    ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                    : "hover:bg-list-hover",
                )}
                data-testid={`stash-entry-${entry.index}`}
              >
                <Package size={13} className="shrink-0 opacity-70" aria-hidden />
                <span className="flex-1 min-w-0 truncate">{entry.message}</span>
                {entry.branch ? (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 text-[length:var(--nx-font-size-ui-sm)] opacity-75"
                    data-testid={`stash-branch-${entry.index}`}
                  >
                    <GitBranch size={11} aria-hidden />
                    {entry.branch}
                  </span>
                ) : null}
                {typeof fileCount === "number" ? (
                  <span
                    className="shrink-0 text-[length:var(--nx-font-size-ui-sm)] opacity-75"
                    data-testid={`stash-filecount-${entry.index}`}
                  >
                    {fileCount} {fileCount === 1 ? "file" : "files"}
                  </span>
                ) : null}
                {entry.relativeDate ? (
                  <span
                    className="shrink-0 text-[length:var(--nx-font-size-ui-sm)] text-vscode-description"
                    title={entry.authoredAt ?? undefined}
                    data-testid={`stash-date-${entry.index}`}
                  >
                    {entry.relativeDate}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <ContextMenu
        menu={menu}
        onClose={() => setMenu(null)}
        testId="stash-context-menu"
        ariaLabel="Stash actions"
      >
        <MenuItem
          label="View changes"
          testId="stash-menu-view"
          hideIcon
          disabled={!onView}
          onClick={() => runFromMenu(onView)}
        />
        <MenuItem
          label="Apply"
          testId="stash-menu-apply"
          hideIcon
          disabled={busy || !onApply}
          onClick={() => runFromMenu(onApply)}
        />
        <MenuItem
          label="Pop"
          testId="stash-menu-pop"
          hideIcon
          disabled={busy || !onPop}
          onClick={() => runFromMenu(onPop)}
        />
        <MenuItem
          label="Drop"
          testId="stash-menu-drop"
          hideIcon
          disabled={busy || !onDrop}
          onClick={() => runFromMenu(onDrop)}
        />
      </ContextMenu>
    </>
  );
}
