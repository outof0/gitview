import { Archive, RefreshCw, Undo2 } from "lucide-react";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import { StashList } from "./StashList";

export type StashPushOptions = {
  message?: string;
  paths?: string[];
  includeUntracked?: boolean;
  keepIndex?: boolean;
};

type StashPanelProps = {
  snapshot: StashListSnapshot | null;
  busy?: boolean;
  onRefresh: () => void;
  onOpenStashDialog: () => void;
  onOpenUnstashDialog: (index?: number) => void;
  onApply: (index: number, opts: { reinstateIndex?: boolean }) => void;
  onPop: (index: number, opts: { reinstateIndex?: boolean }) => void;
  onDrop: (index: number) => void;
};

const toolbarBtn =
  "h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer";

export function StashPanel({
  snapshot,
  busy = false,
  onRefresh,
  onOpenStashDialog,
  onOpenUnstashDialog,
  onApply,
  onPop,
  onDrop,
}: StashPanelProps) {
  const stashes = snapshot?.stashes ?? [];

  return (
    <div
      className="flex-1 min-h-0 flex flex-col px-[var(--nx-pad-x)] py-1.5 gap-1.5"
      data-testid="stash-panel"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={toolbarBtn}
          disabled={busy}
          onClick={onOpenStashDialog}
          data-testid="stash-open-stash-dialog"
        >
          <Archive size={14} aria-hidden />
          Stash Changes…
        </button>
        <button
          type="button"
          className={toolbarBtn}
          disabled={busy || stashes.length === 0}
          onClick={() => onOpenUnstashDialog()}
          data-testid="stash-open-unstash-dialog"
        >
          <Undo2 size={14} aria-hidden />
          Unstash Changes…
        </button>
        <button
          type="button"
          className={toolbarBtn}
          disabled={busy}
          onClick={onRefresh}
          data-testid="stash-refresh"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <StashList
          stashes={stashes}
          selectedIndex={null}
          onSelect={(index) => onOpenUnstashDialog(index)}
          busy={busy}
          onView={(index) => onOpenUnstashDialog(index)}
          onApply={(index) => onApply(index, {})}
          onPop={(index) => onPop(index, {})}
          onDrop={onDrop}
        />
      </div>
    </div>
  );
}
