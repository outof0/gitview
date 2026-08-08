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
      className="nx-tool-titlebar shrink-0 flex items-center justify-between gap-3 h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] px-[var(--nx-pad-x)] border-b border-vscode-panel-border bg-vscode-titlebar-bg font-[family-name:var(--nx-font-ui)]"
      data-testid="git-compare-toolbar"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-[length:var(--nx-font-size-ui)] opacity-75 leading-none shrink-0"
          aria-hidden
        >
          ⇄
        </span>
        <div className="min-w-0 flex items-baseline gap-2">
          <div className="text-[length:var(--nx-font-size-ui)] font-semibold font-editor truncate">
            {fileName}
          </div>
          {filePath !== fileName && (
            <div
              className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description truncate hidden sm:block"
              title={filePath}
            >
              {filePath}
            </div>
          )}
        </div>
      </div>
      {revisions && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="py-0.5 px-2 text-[length:var(--nx-font-size-ui-sm)] font-medium rounded-[var(--nx-menu-radius)] border border-vscode-panel-border bg-input text-input-foreground whitespace-nowrap max-w-[12rem] truncate">
            {revisions.left}
          </span>
          <span
            className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description"
            aria-hidden
          >
            ↔
          </span>
          <span
            className={cn(
              "py-0.5 px-2 text-[length:var(--nx-font-size-ui-sm)] font-medium rounded-[var(--nx-menu-radius)] border bg-input text-input-foreground whitespace-nowrap max-w-[12rem] truncate",
              "border-[color-mix(in_srgb,var(--vscode-gitDecoration-addedResourceForeground,#4ba85a)_50%,var(--vscode-panel-border,#393b40))]",
            )}
          >
            {revisions.right}
          </span>
        </div>
      )}
    </header>
  );
}