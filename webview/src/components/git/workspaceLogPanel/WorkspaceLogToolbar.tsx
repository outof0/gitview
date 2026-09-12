import { Button } from "../../ui/Button";
import { useState } from "react";
import { Check, Eye, GitBranch, Play, RefreshCw, Search } from "lucide-react";
import type { LogQueryFilters } from "@gitview/shared/types/log";
import { LogMenuPortal } from "./logMenuPortal";

type WorkspaceLogToolbarProps = {
  loading: boolean;
  busy: boolean;
  filters: LogQueryFilters;
  onFiltersChange: (filters: LogQueryFilters) => void;
  onExpandedLinearReset: () => void;
  onRefresh: () => void;
};

const iconBtnCls =
  "h-row w-row shrink-0 flex items-center justify-center rounded-vscode hover:bg-list-hover disabled:opacity-40 disabled:hover:bg-transparent text-foreground";
const optionLabelCls =
  "flex items-center gap-2 min-h-menu-item w-full px-menu-pad-x py-menu-pad-y text-ui leading-none text-menu-fg cursor-pointer select-none hover:bg-menu-selection hover:text-menu-selectionForeground text-left outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset";

function focusLogSearch(): void {
  const input = document.querySelector('[data-testid="log-filter-grep"]');
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.select();
  }
}

export function WorkspaceLogToolbar({
  loading,
  busy,
  filters,
  onFiltersChange,
  onExpandedLinearReset,
  onRefresh,
}: WorkspaceLogToolbarProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [viewAnchor, setViewAnchor] = useState<HTMLButtonElement | null>(null);

  const apply = (next: LogQueryFilters, refresh = false) => {
    onFiltersChange(next);
    if (refresh) {
      onRefresh();
    }
  };

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button variant="ghost" size="content"
        type="button"
        className={iconBtnCls}
        title="Apply filters"
        aria-label="Apply filters"
        onClick={() => {
          onExpandedLinearReset();
          onRefresh();
        }}
        disabled={loading || busy}
        data-testid="log-apply-filters"
      >
        <Play size={16} aria-hidden />
      </Button>
      <Button variant="ghost" size="content"
        type="button"
        className={iconBtnCls}
        title="Refresh"
        aria-label="Refresh"
        onClick={onRefresh}
        disabled={loading}
        data-testid="log-refresh"
      >
        <RefreshCw size={16} aria-hidden />
      </Button>
      <Button variant="ghost" size="content"
        type="button"
        className={`${iconBtnCls} ${filters.highlightCurrentBranch ? "bg-list-active text-list-activeForeground hover:bg-list-active" : ""}`}
        title="Highlight current branch"
        aria-pressed={Boolean(filters.highlightCurrentBranch)}
        onClick={() =>
          apply({
            ...filters,
            highlightCurrentBranch: !filters.highlightCurrentBranch,
          })
        }
        data-testid="log-highlight-current-branch"
      >
        <GitBranch size={16} aria-hidden />
      </Button>
      <div className="relative">
        <Button variant="ghost" size="content"
          ref={setViewAnchor}
          type="button"
          className={iconBtnCls}
          title="View options"
          aria-expanded={viewOpen}
          onClick={(event) => {
            event.stopPropagation();
            setViewOpen((open) => !open);
          }}
          data-testid="log-view-options"
        >
          <Eye size={16} aria-hidden />
        </Button>
        <LogMenuPortal
          open={viewOpen}
          anchor={viewAnchor}
          onClose={() => setViewOpen(false)}
          label="View options"
          align="right"
          maxHeight={280}
          width={220}
        >
          {(
            [
              ["noMerges", "No merges", true],
              ["firstParent", "First parent", true],
              ["collapseLinear", "Linear", false],
              ["compactRows", "Compact", false],
            ] as const
          ).map(([key, label, refresh]) => (
            <Button variant="ghost" size="content"
              key={key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={Boolean(filters[key])}
              className={optionLabelCls}
              data-testid={
                key === "compactRows" ? "log-compact-rows" : `log-option-${key === "collapseLinear" ? "collapse-linear" : key === "noMerges" ? "no-merges" : "first-parent"}`
              }
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (key === "collapseLinear") {
                  onExpandedLinearReset();
                }
                apply({ ...filters, [key]: !filters[key] }, refresh);
              }}
            >
              <span
                className={`w-icon-sm h-icon-sm rounded-vscode border flex items-center justify-center shrink-0 ${
                  filters[key]
                    ? "bg-checkbox-bg border-checkbox-border text-checkbox-fg"
                    : "bg-checkbox-bg border-checkbox-border"
                }`}
              >
                {filters[key] ? <Check size={10} aria-hidden /> : null}
              </span>
              {label}
            </Button>
          ))}
        </LogMenuPortal>
      </div>
      <Button variant="ghost" size="content"
        type="button"
        className={iconBtnCls}
        title="Focus search"
        aria-label="Focus search"
        onClick={focusLogSearch}
        data-testid="log-focus-search"
      >
        <Search size={16} aria-hidden />
      </Button>
    </div>
  );
}
