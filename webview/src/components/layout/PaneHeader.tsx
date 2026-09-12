import { useGitViewStore } from "../../stores/gitViewStore";
import { Button } from "../ui/Button";

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
    "flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap px-2 h-toolbar text-ui-sm border-b border-border bg-vscode-titlebar-bg text-vscode-description";

  const linkClass =
    "px-0 text-vscode-link enabled:hover:bg-transparent enabled:hover:underline";

  const showDetails = (
    <Button
      variant="toolbar"
      size="compact"
      className={linkClass}
      onClick={toggleShowDetails}
      title="Show details"
    >
      Show Details
    </Button>
  );

  if (variant === "center") {
    return (
      <div className={headerClass}>
        <span className="font-semibold text-vscode-editor-fg">Result</span>
        <span className="flex-1" />
      </div>
    );
  }

  const branchLabel = (
    <>
      <span className="ui-pane-header-prefix">Changes from</span>
      {branch && (
        <span
          className="min-w-0 truncate font-semibold text-vscode-editor-fg"
          title={branch}
        >
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
