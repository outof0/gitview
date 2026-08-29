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
  "h-[22px] w-[22px] shrink-0 flex items-center justify-center rounded-sm hover:bg-list-hover disabled:opacity-40 disabled:hover:bg-transparent text-vscode-description";
const optionLabelCls =
  "flex items-center gap-2 min-h-7 w-full px-2 text-[length:var(--vscode-font-size,13px)] leading-none text-foreground cursor-pointer select-none hover:bg-[var(--vscode-menu-selectionBackground,var(--vscode-list-hoverBackground))] rounded-sm text-left";

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
      <button
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
      </button>
      <button
        type="button"
        className={iconBtnCls}
        title="Refresh"
        aria-label="Refresh"
        onClick={onRefresh}
        disabled={loading}
        data-testid="log-refresh"
      >
        <RefreshCw size={16} aria-hidden />
      </button>
      <button
        type="button"
        className={`${iconBtnCls} ${filters.highlightCurrentBranch ? "text-foreground bg-list-hover" : ""}`}
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
      </button>
      <div className="relative">
        <button
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
        </button>
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
            <button
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
                className={`w-[14px] h-[14px] rounded-[2px] border flex items-center justify-center shrink-0 ${
                  filters[key]
                    ? "bg-[var(--vscode-checkbox-background,var(--vscode-input-background))] border-[var(--vscode-checkbox-border,var(--border))] text-[var(--vscode-checkbox-foreground,var(--vscode-button-foreground))]"
                    : "bg-[var(--vscode-checkbox-background,transparent)] border-[var(--vscode-checkbox-border,var(--border))]"
                }`}
              >
                {filters[key] ? <Check size={10} aria-hidden /> : null}
              </span>
              {label}
            </button>
          ))}
        </LogMenuPortal>
      </div>
      <button
        type="button"
        className={iconBtnCls}
        title="Focus search"
        aria-label="Focus search"
        onClick={focusLogSearch}
        data-testid="log-focus-search"
      >
        <Search size={16} aria-hidden />
      </button>
    </div>
  );
}
