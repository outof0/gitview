import { useState } from "react";
import { Archive, ClipboardPaste, Package, Trash2 } from "lucide-react";
import type { ShelfListSnapshot } from "@gitview/shared/types/shelf";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import { StashPanel } from "./stash/StashPanel";

type WorkspaceTemporaryWorkPanelProps = {
  subTab: "stash" | "shelf" | "patch";
  onSubTabChange: (tab: "stash" | "shelf" | "patch") => void;
  stashSnapshot: StashListSnapshot | null;
  shelfSnapshot: ShelfListSnapshot | null;
  patchPreview: string | null;
  busy?: boolean;
  currentBranch?: string | null;
  onRefreshStash: () => void;
  onRefreshShelf: () => void;
  onOpenStashDialog: () => void;
  onOpenUnstashDialog: (index?: number) => void;
  onApplyStash: (index: number, opts: { reinstateIndex?: boolean }) => void;
  onPopStash: (index: number, opts: { reinstateIndex?: boolean }) => void;
  onDropStash: (index: number) => void;
  onShelveSelected: (paths: string[]) => void;
  onUnshelve: (shelfId: string) => void;
  onDeleteShelf: (shelfId: string) => void;
  onCreatePatch: () => void;
  onApplyPatchClipboard: (opts?: { strip?: number; directory?: string }) => void;
  onImportShelfPatch: () => void;
  selectedPaths: string[];
};

export function WorkspaceTemporaryWorkPanel({
  subTab,
  onSubTabChange,
  stashSnapshot,
  shelfSnapshot,
  patchPreview,
  busy = false,
  onRefreshStash,
  onRefreshShelf,
  onOpenStashDialog,
  onOpenUnstashDialog,
  onApplyStash,
  onPopStash,
  onDropStash,
  onShelveSelected,
  onUnshelve,
  onDeleteShelf,
  onCreatePatch,
  onApplyPatchClipboard,
  onImportShelfPatch,
  selectedPaths,
}: WorkspaceTemporaryWorkPanelProps) {
  const [patchStrip, setPatchStrip] = useState(1);
  const [patchDirectory, setPatchDirectory] = useState("");

  const btn =
    "h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40 inline-flex items-center gap-1";

  return (
    <div
      className="flex-1 min-h-0 flex flex-col font-[family-name:var(--nx-font-ui)]"
      data-testid="workspace-temporary-panel"
    >
      <div className="shrink-0 flex h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] border-b border-border">
        {(["stash", "shelf", "patch"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-2.5 h-full text-[length:var(--nx-font-size-ui)] border-b-2 capitalize ${
              subTab === tab
                ? "border-[var(--vscode-focusBorder)] font-semibold"
                : "border-transparent text-vscode-description hover:bg-list-hover"
            }`}
            onClick={() => onSubTabChange(tab)}
            data-testid={`temporary-subtab-${tab}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {subTab === "stash" && (
        <StashPanel
          snapshot={stashSnapshot}
          busy={busy}
          onRefresh={onRefreshStash}
          onOpenStashDialog={onOpenStashDialog}
          onOpenUnstashDialog={onOpenUnstashDialog}
          onApply={onApplyStash}
          onPop={onPopStash}
          onDrop={onDropStash}
        />
      )}

      {subTab === "shelf" && (
        <div className="flex-1 min-h-0 flex flex-col px-[var(--nx-pad-x)] py-1.5 gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={btn}
              disabled={busy || selectedPaths.length === 0}
              onClick={() => onShelveSelected(selectedPaths)}
              data-testid="shelve-selected-button"
            >
              <Archive size={14} aria-hidden />
              Shelve selected
            </button>
            <button
              type="button"
              className={btn}
              onClick={onRefreshShelf}
              disabled={busy}
              data-testid="shelf-refresh"
            >
              Refresh
            </button>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto m-0 p-0 list-none" data-testid="shelf-list">
            {(shelfSnapshot?.shelves ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-1.5 px-1.5 h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] border-b border-border text-[length:var(--nx-font-size-ui)]"
                data-testid={`shelf-entry-${entry.id}`}
              >
                <Package size={14} className="shrink-0 opacity-70" aria-hidden />
                <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                  <span className="font-medium truncate">{entry.name}</span>
                  <span className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description truncate">
                    {entry.paths.join(", ")}
                  </span>
                </div>
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  onClick={() => onUnshelve(entry.id)}
                >
                  Unshelve
                </button>
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  onClick={() => onDeleteShelf(entry.id)}
                  aria-label="Delete shelf"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
            {(shelfSnapshot?.shelves ?? []).length === 0 && (
              <li
                className="px-1 py-2 text-[length:var(--nx-font-size-ui)] text-vscode-description list-none"
                data-testid="shelf-empty"
              >
                No shelves.
              </li>
            )}
          </ul>
        </div>
      )}

      {subTab === "patch" && (
        <div className="flex-1 min-h-0 flex flex-col px-[var(--nx-pad-x)] py-1.5 gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={onCreatePatch}
              data-testid="patch-create-button"
            >
              Create patch from changes
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                onApplyPatchClipboard({
                  strip: patchStrip,
                  directory: patchDirectory || undefined,
                })
              }
              data-testid="patch-apply-clipboard"
            >
              <ClipboardPaste size={14} aria-hidden />
              Apply from clipboard
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={onImportShelfPatch}
              data-testid="shelf-import-patch"
            >
              <Archive size={14} aria-hidden />
              Import to shelf
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[length:var(--nx-font-size-ui-sm)]">
            <label className="flex items-center gap-1">
              Strip
              <input
                type="number"
                min={0}
                max={10}
                className="w-10 h-[var(--nx-row-h)] px-1 rounded-vscode border border-border bg-[var(--vscode-input-background)]"
                value={patchStrip}
                onChange={(e) => setPatchStrip(Number(e.target.value) || 0)}
                data-testid="patch-strip-input"
              />
            </label>
            <input
              type="text"
              className="flex-1 min-w-[120px] h-[var(--nx-row-h)] px-1.5 rounded-vscode border border-border bg-[var(--vscode-input-background)]"
              placeholder="Directory prefix (optional)"
              value={patchDirectory}
              onChange={(e) => setPatchDirectory(e.target.value)}
              data-testid="patch-directory-input"
            />
          </div>
          <pre
            className="flex-1 min-h-0 overflow-auto m-0 p-1.5 text-[length:var(--nx-font-size-ui-sm)] font-mono rounded-vscode border border-border bg-[var(--vscode-editor-background)] whitespace-pre-wrap"
            data-testid="patch-preview"
          >
            {patchPreview?.trim() || "Create a patch to preview unified diff output."}
          </pre>
        </div>
      )}
    </div>
  );
}