import { cn } from "../../lib/cn";

type GitCompareToolbarProps = {
  filePath: string;
  title?: string;
  leftLabel?: string;
  rightLabel?: string;
};

function parseRevisionLabels(
  title: string | undefined,
  leftLabel: string | undefined,
  rightLabel: string | undefined,
): { left: string; right: string } | null {
  if (leftLabel && rightLabel) {
    return { left: leftLabel, right: rightLabel };
  }
  if (!title) {
    return null;
  }
  const match = title.match(/\(([^↔]+)↔([^)]+)\)/);
  if (!match) {
    return null;
  }
  return { left: match[1]!.trim(), right: match[2]!.trim() };
}

export function GitCompareToolbar({
  filePath,
  title,
  leftLabel,
  rightLabel,
}: GitCompareToolbarProps) {
  const fileName = filePath.split("/").pop() ?? filePath;
  const revisions = parseRevisionLabels(title, leftLabel, rightLabel);

  return (
    <header
      className="nx-tool-titlebar ui-responsive-toolbar shrink-0 flex min-w-0 items-center justify-between gap-3 h-toolbar min-h-toolbar px-pad-x border-b border-vscode-panel-border bg-vscode-titlebar-bg font-ui"
      data-testid="git-compare-toolbar"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-ui opacity-75 leading-none shrink-0"
          aria-hidden
        >
          ⇄
        </span>
        <div className="min-w-0 flex items-baseline gap-2">
          <div className="text-ui font-semibold font-editor truncate">
            {fileName}
          </div>
          {filePath !== fileName && (
            <div
              className="text-ui-sm text-vscode-description truncate hidden sm:block"
              title={filePath}
            >
              {filePath}
            </div>
          )}
        </div>
      </div>
      {revisions && (
        <div className="ui-toolbar-secondary flex items-center gap-1.5 shrink-0">
          <span className="py-0.5 px-2 text-ui-sm font-medium rounded-[var(--nx-menu-radius)] border border-vscode-panel-border bg-input text-input-foreground whitespace-nowrap max-w-[12rem] truncate">
            {revisions.left}
          </span>
          <span
            className="text-ui-sm text-vscode-description"
            aria-hidden
          >
            ↔
          </span>
          <span
            className={cn(
              "py-0.5 px-2 text-ui-sm font-medium rounded-[var(--nx-menu-radius)] border bg-input text-input-foreground whitespace-nowrap max-w-[12rem] truncate",
              "border-[color-mix(in_srgb,var(--nx-status-added)_50%,var(--nx-panel-border))]",
            )}
          >
            {revisions.right}
          </span>
        </div>
      )}
    </header>
  );
}
