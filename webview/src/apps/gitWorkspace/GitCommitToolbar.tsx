import { Button } from "../../components/ui/Button";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  ChevronsDown,
  ChevronsUp,
  Eye,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

type GitCommitToolbarProps = {
  busy?: boolean;
  hasSelection: boolean;
  /** Diff requires a concrete file; rollback can also operate on a scope. */
  hasDiffSelection?: boolean;
  onRefresh: () => void;
  onRollback: () => void;
  onShowDiff: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
};

const iconBtn = "h-row w-row shrink-0 text-icon-fg";

export function GitCommitToolbar({
  busy = false,
  hasSelection,
  hasDiffSelection = hasSelection,
  onRefresh,
  onRollback,
  onShowDiff,
  onExpandAll,
  onCollapseAll,
}: GitCommitToolbarProps) {
  return (
    <div
      className="flex h-toolbar min-h-toolbar w-full shrink-0 items-center gap-0.5 border-b border-border bg-vscode-sidebar-bg px-pad-x"
      data-testid="commit-toolbar"
    >
      <Tooltip label="Refresh changes">
        <Button
          variant="toolbar"
          size="icon"
          className={iconBtn}
          disabled={busy}
          onClick={onRefresh}
          aria-label="Refresh changes"
          data-testid="commit-toolbar-refresh"
        >
          <RefreshCw size={16} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip label="Rollback selected change">
        <Button
          variant="toolbar"
          size="icon"
          className={iconBtn}
          disabled={busy || !hasSelection}
          onClick={onRollback}
          aria-label="Rollback selected change"
          data-testid="commit-toolbar-rollback"
        >
          <RotateCcw size={16} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip label="Open diff for selected change">
        <Button
          variant="toolbar"
          size="icon"
          className={iconBtn}
          disabled={!hasDiffSelection}
          onClick={onShowDiff}
          aria-label="Open diff for selected change"
          data-testid="commit-toolbar-diff"
        >
          <Eye size={16} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip label="Expand all change groups">
        <Button
          variant="toolbar"
          size="icon"
          className={iconBtn}
          disabled={busy}
          onClick={() => onExpandAll?.()}
          aria-label="Expand all change groups"
          data-testid="commit-toolbar-expand-all"
        >
          <ChevronsDown size={16} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip label="Collapse all change groups">
        <Button
          variant="toolbar"
          size="icon"
          className={iconBtn}
          disabled={busy}
          onClick={() => onCollapseAll?.()}
          aria-label="Collapse all change groups"
          data-testid="commit-toolbar-collapse-all"
        >
          <ChevronsUp size={16} aria-hidden />
        </Button>
      </Tooltip>
    </div>
  );
}
