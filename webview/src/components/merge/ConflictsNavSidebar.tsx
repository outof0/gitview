import { Button } from "../ui/Button";
import type { BlockRows } from "./rows";
import { ScrollArea } from "../ui/ScrollArea";

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
  added: "bg-status-added",
  modified:
    "bg-status-modified",
  deleted: "bg-vscode-description",
  conflict: "bg-editor-error-fg",
};

export function ConflictsNavSidebar({
  changes,
  activeBlockId,
  onJump,
}: ConflictsNavSidebarProps) {
  return (
    <div
      className="w-60 flex flex-col border-l border-border bg-vscode-sidebar-bg overflow-hidden font-sans"
      data-testid="conflicts-nav"
    >
      <div className="h-control flex items-center px-2.5 text-ui-sm font-semibold text-sidebar-title-fg border-b border-border">
        Conflicts Navigation ({changes.length})
      </div>
      <ScrollArea axis="vertical" className="flex-1">
        {changes.length === 0 ? (
          <div
            className="w-full px-2.5 py-1.5 text-xs text-vscode-description"
            aria-disabled="true"
          >
            No changes
          </div>
        ) : (
          changes.map((c, i) => {
            const isActive = activeBlockId === c.blockId;
            return (
              <Button variant="ghost" size="content"
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
                  className={`flex-none text-section ${
                    c.resolved
                      ? "text-status-added"
                      : isActive
                        ? "text-list-activeForeground/80"
                        : "text-editor-warning-fg"
                  }`}
                >
                  {c.resolved ? "resolved" : "unresolved"}
                </span>
              </Button>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
