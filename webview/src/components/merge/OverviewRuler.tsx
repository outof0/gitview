import type { BlockRows } from "./rows";
import { cn } from "../../lib/cn";

type OverviewRulerProps = {
  blocks: BlockRows[];
  onJump: (blockId: string) => void;
};

const tickColor: Record<string, string> = {
  added: "bg-[var(--vscode-gitDecoration-addedResourceForeground,#4ba85a)]",
  modified:
    "bg-[var(--vscode-gitDecoration-modifiedResourceForeground,#3887c7)]",
  conflict: "bg-[var(--vscode-editorError-foreground,#cf5c56)]",
  deleted: "bg-[var(--vscode-descriptionForeground,#6b6c6e)]",
};

export function OverviewRuler({ blocks, onJump }: OverviewRulerProps) {
  const totalLines = Math.max(
    1,
    blocks.reduce((acc, b) => acc + Math.max(1, b.center.length), 0),
  );

  let cursor = 0;
  const ticks = blocks.map((b) => {
    const top = (cursor / totalLines) * 100;
    cursor += Math.max(1, b.center.length);
    return { block: b, top };
  });

  return (
    <div
      className="w-3.5 bg-[var(--vscode-editorOverviewRuler-background,rgba(0,0,0,0.1))] border-l border-vscode-panel-border relative cursor-pointer shrink-0 h-full self-stretch"
      data-testid="overview-ruler"
    >
      {ticks
        .filter((t) => t.block.navigable)
        .map((t) => (
          <div
            key={t.block.blockId}
            role="button"
            tabIndex={0}
            className={cn(
              "absolute left-0.5 w-2.5 h-0.5 rounded-sm",
              tickColor[t.block.changeType] ??
                "bg-[var(--vscode-descriptionForeground,#6b6c6e)]",
            )}
            data-testid="overview-ruler-tick"
            style={{ top: `${t.top}%` }}
            title={`${t.block.changeType} block`}
            aria-label={`Jump to ${t.block.changeType} at line ${t.block.resultStart + 1}`}
            onClick={() => onJump(t.block.blockId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onJump(t.block.blockId);
              }
            }}
          />
        ))}
    </div>
  );
}