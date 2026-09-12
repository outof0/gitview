import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";
import type {
  ReviewFilters,
  ReviewListSnapshot,
} from "@gitview/shared/types/review";
import { TextField } from "../../ui/TextField";

type WorkspaceReviewToolbarProps = {
  snapshot: ReviewListSnapshot | null;
  filters: ReviewFilters;
  busy: boolean;
  canCreateReview: boolean;
  onRefresh: () => void;
  onFiltersChange: (filters: ReviewFilters) => void;
  onProviderChange: (providerId: string) => void;
  onCreateReview?: () => void;
};

export function WorkspaceReviewToolbar({
  snapshot,
  filters,
  busy,
  canCreateReview,
  onRefresh,
  onFiltersChange,
  onProviderChange,
  onCreateReview,
}: WorkspaceReviewToolbarProps) {
  const providers = snapshot?.providers ?? [];
  const selectedProvider = snapshot?.selectedProviderId ?? null;

  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
      <SelectField
        className="h-7 px-2 text-ui-sm rounded-vscode border border-border bg-input"
        value={selectedProvider ?? ""}
        onChange={(e) => onProviderChange(e.target.value)}
        disabled={busy || providers.length === 0}
        aria-label="Review provider"
        data-testid="review-provider-select"
      >
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.displayName}
            {!provider.available ? " (unavailable)" : ""}
          </option>
        ))}
      </SelectField>
      <SelectField
        className="h-7 px-2 text-ui-sm rounded-vscode border border-border bg-input"
        value={filters.state ?? "open"}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            state: e.target.value as ReviewFilters["state"],
          })
        }
        disabled={busy}
        aria-label="Review state filter"
        data-testid="review-state-filter"
      >
        <option value="open">Open</option>
        <option value="closed">Closed</option>
        <option value="all">All</option>
      </SelectField>
      <SelectField
        className="h-7 px-2 text-ui-sm rounded-vscode border border-border bg-input"
        value={filters.sort ?? "updated"}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            sort: e.target.value as ReviewFilters["sort"],
          })
        }
        disabled={busy}
        aria-label="Review sort"
        data-testid="review-sort-filter"
      >
        <option value="updated">Recently updated</option>
        <option value="created">Recently created</option>
      </SelectField>
      <TextField
        type="search"
        containerClassName="w-review-filter"
        inputClassName="text-ui-sm"
        placeholder="Author"
        value={filters.author ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, author: e.target.value })
        }
        disabled={busy}
        aria-label="Filter reviews by author"
        data-testid="review-author-filter"
      />
      <TextField
        type="search"
        containerClassName="w-review-filter"
        inputClassName="text-ui-sm"
        placeholder="Label"
        value={filters.label ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, label: e.target.value })}
        disabled={busy}
        aria-label="Filter reviews by label"
        data-testid="review-label-filter"
      />
      <TextField
        type="search"
        containerClassName="w-review-filter"
        inputClassName="text-ui-sm"
        placeholder="Assignee"
        value={filters.assignee ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, assignee: e.target.value })
        }
        disabled={busy}
        aria-label="Filter reviews by assignee"
        data-testid="review-assignee-filter"
      />
      <TextField
        type="search"
        containerClassName="w-review-filter"
        inputClassName="text-ui-sm"
        placeholder="Milestone"
        value={filters.milestone ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, milestone: e.target.value })
        }
        disabled={busy}
        aria-label="Filter reviews by milestone"
        data-testid="review-milestone-filter"
      />
      <TextField
        type="search"
        containerClassName="flex-1 min-w-0"
        inputClassName="text-ui-sm"
        placeholder="Search reviews"
        value={filters.search ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, search: e.target.value })
        }
        disabled={busy}
        aria-label="Search reviews"
        data-testid="review-search-filter"
      />
      <Button variant="ghost" size="content"
        type="button"
        className="h-7 px-2 text-ui-sm rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
        onClick={onRefresh}
        disabled={busy}
        aria-label="Refresh reviews"
        data-testid="review-refresh"
      >
        Refresh
      </Button>
      {onCreateReview && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-7 px-2 text-ui-sm rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          onClick={onCreateReview}
          disabled={busy || !canCreateReview}
          aria-label="Create pull request or merge request"
          data-testid="review-create-toggle"
        >
          Create
        </Button>
      )}
    </div>
  );
}
