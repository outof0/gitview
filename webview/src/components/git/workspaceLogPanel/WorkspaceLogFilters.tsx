import type { LogQueryFilters, LogQueryRange } from "@gitview/shared/types/log";

type WorkspaceLogFiltersProps = {
  filters: LogQueryFilters;
  onFiltersChange: (filters: LogQueryFilters) => void;
  hasUpstream: boolean;
  loading: boolean;
  busy: boolean;
  onRefresh: () => void;
  onExpandedLinearReset: () => void;
};

export function WorkspaceLogFilters({
  filters,
  onFiltersChange,
  hasUpstream,
  loading,
  busy,
  onRefresh,
  onExpandedLinearReset,
}: WorkspaceLogFiltersProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2" data-testid="log-filters">
        <select
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          value={filters.range ?? "all"}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              range: e.target.value as LogQueryRange,
            })
          }
          data-testid="log-filter-range"
        >
          <option value="all">All commits</option>
          <option value="incoming" disabled={!hasUpstream}>
            Incoming
          </option>
          <option value="outgoing" disabled={!hasUpstream}>
            Outgoing
          </option>
        </select>
        <input
          type="text"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          placeholder="Branch"
          value={filters.branch ?? ""}
          disabled={(filters.range ?? "all") !== "all"}
          onChange={(e) =>
            onFiltersChange({ ...filters, branch: e.target.value })
          }
          data-testid="log-filter-branch"
        />
        <input
          type="text"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          placeholder="Author"
          value={filters.author ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, author: e.target.value })
          }
          data-testid="log-filter-author"
        />
        <input
          type="text"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          placeholder="Search message"
          value={filters.grep ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, grep: e.target.value })
          }
          data-testid="log-filter-grep"
        />
        <input
          type="date"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          value={filters.since ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, since: e.target.value })
          }
          data-testid="log-filter-since"
        />
        <input
          type="date"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          value={filters.until ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, until: e.target.value })
          }
          data-testid="log-filter-until"
        />
        <input
          type="text"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)] col-span-2"
          placeholder="Path (e.g. src/app.ts)"
          value={filters.path ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, path: e.target.value })
          }
          data-testid="log-filter-path"
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="log-graph-options"
      >
        <select
          className="h-7 px-2 text-[11px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          value={filters.graphSort ?? "date"}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              graphSort: e.target.value as LogQueryFilters["graphSort"],
            })
          }
          data-testid="log-graph-sort"
        >
          <option value="date">Sort by date</option>
          <option value="topological">Topological sort</option>
        </select>
        <label className="flex items-center gap-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <input
            type="checkbox"
            checked={Boolean(filters.highlightCurrentBranch)}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                highlightCurrentBranch: e.target.checked,
              })
            }
            data-testid="log-highlight-current-branch"
          />
          Highlight current branch
        </label>
        <label className="flex items-center gap-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <input
            type="checkbox"
            checked={Boolean(filters.compactRows)}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                compactRows: e.target.checked,
              })
            }
            data-testid="log-compact-rows"
          />
          Compact rows
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3" data-testid="log-options">
        <label className="flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <input
            type="checkbox"
            checked={Boolean(filters.noMerges)}
            onChange={(e) =>
              onFiltersChange({ ...filters, noMerges: e.target.checked })
            }
            data-testid="log-option-no-merges"
          />
          Hide merge commits
        </label>
        <label className="flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <input
            type="checkbox"
            checked={Boolean(filters.firstParent)}
            onChange={(e) =>
              onFiltersChange({ ...filters, firstParent: e.target.checked })
            }
            data-testid="log-option-first-parent"
          />
          First parent only
        </label>
        <label className="flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <input
            type="checkbox"
            checked={Boolean(filters.collapseLinear)}
            onChange={(e) => {
              onExpandedLinearReset();
              onFiltersChange({ ...filters, collapseLinear: e.target.checked });
            }}
            data-testid="log-option-collapse-linear"
          />
          Collapse linear branches
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover"
          onClick={() => {
            onExpandedLinearReset();
            onRefresh();
          }}
          disabled={loading || busy}
          data-testid="log-apply-filters"
        >
          Apply filters
        </button>
        <button
          type="button"
          className="h-7 px-2 text-[11px] rounded-vscode border border-border hover:bg-list-hover"
          onClick={() => {
            onExpandedLinearReset();
            onFiltersChange({ range: "all", limit: 200 });
          }}
          data-testid="log-clear-filters"
        >
          Clear
        </button>
      </div>
    </>
  );
}