import { useGitViewStore } from "../../stores/gitViewStore";

// Pane header for side-by-side merge panes.
type PaneVariant = "left" | "center" | "right";

type PaneHeaderProps = {
  variant: PaneVariant;
  // Branch name for the side panes ("Changes from <branch>").
  branch?: string;
  onToggleShowDetails?: () => void;
};

export function PaneHeader({
  variant,
  branch,
  onToggleShowDetails,
}: PaneHeaderProps) {
  const globalToggleShowDetails = useGitViewStore((s) => s.toggleShowDetails);
  const toggleShowDetails = onToggleShowDetails || globalToggleShowDetails;

  const headerClass =
    "flex items-center gap-1.5 px-2.5 h-[26px] text-[11.5px] border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background))] text-[var(--vscode-descriptionForeground)]";

  const linkClass =
    "text-[11px] text-[var(--vscode-textLink-foreground)] hover:underline cursor-pointer bg-transparent border-none p-0";

  const showDetails = (
    <button
      type="button"
      className={linkClass}
      onClick={toggleShowDetails}
      title="Show details"
    >
      Show Details
    </button>
  );

  if (variant === "center") {
    return (
      <div className={headerClass}>
        <span className="font-semibold text-[var(--vscode-editor-foreground)]">
          Result
        </span>
        <span className="flex-1" />
      </div>
    );
  }

  const branchLabel = (
    <>
      <span>Changes from</span>
      {branch && (
        <span className="font-semibold text-[var(--vscode-editor-foreground)]">
          {branch}
        </span>
      )}
    </>
  );

  if (variant === "right") {
    return (
      <div className={headerClass}>
        {showDetails}
        <span className="flex-1" />
        {branchLabel}
      </div>
    );
  }

  // left
  return (
    <div className={headerClass}>
      {branchLabel}
      <span className="flex-1" />
      {showDetails}
    </div>
  );
}
