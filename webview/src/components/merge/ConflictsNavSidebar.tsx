import type { BlockRows } from "./rows";

type ConflictsNavSidebarProps = {
  changes: BlockRows[];
  activeBlockId: string | null;
  onJump: (blockId: string) => void;
};

const TYPE_LABEL: Record<BlockRows["changeType"], string> = {
  unchanged: "Unchanged",
  added: "Addition",
  modified: "Modification",
  deleted: "Deletion",
  conflict: "Conflict",
};

const DOT_BG: Record<BlockRows["changeType"], string> = {
  unchanged: "bg-foreground/40",
  added: "bg-[var(--vscode-gitDecoration-addedResourceForeground,#4ba85a)]",
  modified:
    "bg-[var(--vscode-gitDecoration-modifiedResourceForeground,#3887c7)]",
  deleted: "bg-[var(--vscode-descriptionForeground,#6b6c6e)]",
  conflict: "bg-[var(--vscode-editorError-foreground,#cf5c56)]",
};

export function ConflictsNavSidebar({
  changes,
  activeBlockId,
  onJump,
}: ConflictsNavSidebarProps) {
  return (
    <div
      className="w-60 flex flex-col border-l border-border bg-[var(--vscode-sideBar-background,var(--background))] overflow-hidden font-sans"
      data-testid="conflicts-nav"
    >
      <div className="h-[26px] flex items-center px-2.5 text-[11px] font-semibold text-[var(--vscode-sideBarTitle-foreground,var(--vscode-descriptionForeground,#70727a))] border-b border-border">
        Conflicts Navigation ({changes.length})
      </div>
      <div className="flex-1 overflow-auto">
        {changes.length === 0 ? (
          <div
            className="w-full px-2.5 py-1.5 text-xs text-[var(--vscode-descriptionForeground,#70727a)]"
            aria-disabled="true"
          >
            No changes
          </div>
        ) : (
          changes.map((c, i) => {
            const isActive = activeBlockId === c.blockId;
            return (
              <button
                type="button"
                key={c.blockId}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-foreground hover:bg-list-hover outline-none cursor-pointer border-none bg-transparent ${
                  isActive
                    ? "bg-list-active text-list-activeForeground hover:bg-list-active"
                    : ""
                }`}
                data-block={c.blockId}
                aria-label={`jump-${c.blockId}`}
                onClick={() => onJump(c.blockId)}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_BG[c.changeType]}`}
                />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {`${i + 1}. ${TYPE_LABEL[c.changeType]}`}
                </span>
                <span
                  className={`flex-none text-[10px] ${
                    c.resolved
                      ? "text-[var(--vscode-gitDecoration-addedResourceForeground,#4ba85a)]"
                      : isActive
                        ? "text-list-activeForeground/80"
                        : "text-[var(--vscode-editorWarning-foreground,#e0ad53)]"
                  }`}
                >
                  {c.resolved ? "resolved" : "unresolved"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
