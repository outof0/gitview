import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ListFilter, Search } from "lucide-react";
import type { LogQueryFilters, LogQueryRange } from "@gitview/shared/types/log";
import { LogMenuPortal } from "./logMenuPortal";
import { LogDatePicker } from "./LogDatePicker";
import { isoDaysAgo } from "./localIsoDate";

type WorkspaceLogFiltersProps = {
  filters: LogQueryFilters;
  onFiltersChange: (filters: LogQueryFilters) => void;
  hasUpstream: boolean;
  onExpandedLinearReset: () => void;
  branches?: string[];
  authors?: string[];
  paths?: string[];
  onBranchMenuOpen?: () => void;
};

type OpenMenu = "branch" | "user" | "date" | "paths" | "sort" | null;

const chipBtn =
  "h-6 px-2 inline-flex items-center gap-1 rounded-sm text-[length:var(--vscode-font-size,13px)] leading-none hover:bg-list-hover shrink-0 pointer-events-auto";
const fieldCls =
  "h-7 w-full min-w-0 box-border px-2 text-[length:var(--vscode-font-size,13px)] leading-none rounded-sm border border-[var(--vscode-input-border,var(--border))] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground,var(--vscode-editor-foreground))] placeholder:text-[var(--vscode-input-placeholderForeground,var(--vscode-descriptionForeground))]";
const itemCls =
  "h-7 px-2 w-full min-w-0 truncate text-left text-[length:var(--vscode-font-size,13px)] leading-none rounded-sm text-[var(--vscode-menu-foreground,var(--vscode-editor-foreground))] hover:bg-[var(--vscode-menu-selectionBackground,var(--vscode-list-hoverBackground))] hover:text-[var(--vscode-menu-selectionForeground,var(--vscode-editor-foreground))] disabled:opacity-40";

function FilterChip({
  id,
  label,
  value,
  open,
  onToggle,
  onClose,
  children,
  maxHeight,
  width,
}: {
  id: string;
  label: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: number;
  width?: number;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <div className="relative shrink-0" data-testid={`${id}-chip`}>
      <button
        ref={setAnchor}
        type="button"
        className={`${chipBtn} ${value ? "text-foreground" : "text-vscode-description"}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        data-testid={`${id}-trigger`}
      >
        <span className="max-w-[120px] truncate">{value || label}</span>
        <ChevronDown size={12} aria-hidden className="text-vscode-description" />
      </button>
      <LogMenuPortal
        open={open}
        anchor={anchor}
        onClose={onClose}
        label={label}
        maxHeight={maxHeight}
        width={width}
      >
        {children}
      </LogMenuPortal>
    </div>
  );
}

export function WorkspaceLogFilters({
  filters,
  onFiltersChange,
  hasUpstream,
  onExpandedLinearReset,
  branches = [],
  authors = [],
  paths = [],
  onBranchMenuOpen,
}: WorkspaceLogFiltersProps) {
  const [open, setOpen] = useState<OpenMenu>(null);
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<HTMLButtonElement | null>(null);
  const [branchQuery, setBranchQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [pathQuery, setPathQuery] = useState("");
  const [showDateCustom, setShowDateCustom] = useState(false);

  const toggle = (menu: OpenMenu) => {
    setOpen((current) => {
      const next = current === menu ? null : menu;
      if (next === "branch") {
        onBranchMenuOpen?.();
      }
      if (next !== "date") {
        setShowDateCustom(false);
      }
      return next;
    });
  };
  const close = () => {
    setOpen(null);
    setShowDateCustom(false);
  };

  const visibleBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    return query
      ? branches.filter((name) => name.toLowerCase().includes(query))
      : branches;
  }, [branches, branchQuery]);
  const visibleAuthors = useMemo(() => {
    const query = authorQuery.trim().toLowerCase();
    return query
      ? authors.filter((name) => name.toLowerCase().includes(query))
      : authors;
  }, [authors, authorQuery]);
  const visiblePaths = useMemo(() => {
    const query = pathQuery.trim().toLowerCase();
    return query
      ? paths.filter((path) => path.toLowerCase().includes(query))
      : paths;
  }, [paths, pathQuery]);

  const branchChipValue =
    filters.range === "incoming"
      ? "Incoming"
      : filters.range === "outgoing"
        ? "Outgoing"
        : filters.branch;

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap" data-testid="log-filters">
      <label className="h-7 w-[260px] max-w-[260px] shrink-0 inline-flex items-center gap-1.5 px-2 rounded-[2px] border border-[var(--vscode-input-border,var(--border))] bg-[var(--vscode-input-background)]">
        <Search size={14} aria-hidden className="text-vscode-description shrink-0" />
        <input
          type="text"
          className="flex-1 min-w-0 h-full bg-transparent text-[length:var(--vscode-font-size,13px)] leading-none text-[var(--vscode-input-foreground,var(--vscode-editor-foreground))] placeholder:text-[var(--vscode-input-placeholderForeground,var(--vscode-descriptionForeground))] outline-none"
          placeholder="Text or hash"
          value={filters.grep ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, grep: e.target.value })}
          data-testid="log-filter-grep"
        />
        <button
          type="button"
          className={`h-4 w-[22px] shrink-0 text-[10px] leading-none rounded-sm ${regex ? "text-foreground bg-list-hover" : "text-vscode-description"}`}
          aria-pressed={regex}
          title="Regular expression"
          onClick={() => setRegex((v) => !v)}
          data-testid="log-filter-regex"
        >
          .*
        </button>
        <button
          type="button"
          className={`h-4 w-[22px] shrink-0 text-[9px] leading-none rounded-sm ${matchCase ? "text-foreground bg-list-hover" : "text-vscode-description"}`}
          aria-pressed={matchCase}
          title="Match case"
          onClick={() => setMatchCase((v) => !v)}
          data-testid="log-filter-case"
        >
          Cc
        </button>
      </label>

      <FilterChip
        id="log-filter-branch"
        label="Branch"
        value={branchChipValue}
        open={open === "branch"}
        onToggle={() => toggle("branch")}
        onClose={close}
      >
        <input
          type="text"
          className={fieldCls}
          placeholder="Filter branches"
          value={branchQuery || filters.branch || ""}
          onChange={(e) => {
            setBranchQuery(e.target.value);
            onFiltersChange({ ...filters, branch: e.target.value, range: "all" });
          }}
          data-testid="log-filter-branch"
          autoFocus
        />
        {(["all", "incoming", "outgoing"] as const).map((range) => (
          <button
            key={range}
            type="button"
            className={itemCls}
            disabled={range !== "all" && !hasUpstream}
            data-testid={`log-filter-range-${range}`}
            onClick={() => {
              onFiltersChange({
                ...filters,
                range: range as LogQueryRange,
                branch: range === "all" ? filters.branch : undefined,
              });
              if (range !== "all") {
                close();
              }
            }}
          >
            {range === "all" ? "All commits" : range === "incoming" ? "Incoming" : "Outgoing"}
          </button>
        ))}
        <div className="h-px my-1 bg-[var(--vscode-menu-separatorBackground,var(--border))]" />
        {visibleBranches.map((name) => (
          <button
            key={name}
            type="button"
            className={itemCls}
            onClick={() => {
              setBranchQuery("");
              onFiltersChange({ ...filters, branch: name, range: "all" });
              close();
            }}
          >
            {name}
          </button>
        ))}
      </FilterChip>

      <FilterChip
        id="log-filter-author"
        label="User"
        value={filters.author}
        open={open === "user"}
        onToggle={() => toggle("user")}
        onClose={close}
      >
        <input
          type="text"
          className={fieldCls}
          placeholder="User"
          value={authorQuery || filters.author || ""}
          onChange={(e) => {
            setAuthorQuery(e.target.value);
            onFiltersChange({ ...filters, author: e.target.value });
          }}
          data-testid="log-filter-author"
          autoFocus
        />
        {visibleAuthors.map((name) => (
          <button
            key={name}
            type="button"
            className={itemCls}
            onClick={() => {
              setAuthorQuery("");
              onFiltersChange({ ...filters, author: name });
              close();
            }}
          >
            {name}
          </button>
        ))}
      </FilterChip>

      <FilterChip
        id="log-filter-date"
        label="Date"
        value={
          filters.since || filters.until
            ? `${filters.since ?? "…"} – ${filters.until ?? "…"}`
            : undefined
        }
        open={open === "date"}
        onToggle={() => toggle("date")}
        onClose={close}
        maxHeight={showDateCustom ? 420 : 280}
        width={showDateCustom ? 300 : 220}
      >
        {!showDateCustom ? (
          <>
            <button
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({ ...filters, since: undefined, until: undefined });
                close();
              }}
            >
              Any date
            </button>
            <button
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({ ...filters, since: isoDaysAgo(1), until: undefined });
                close();
              }}
            >
              Last 24 hours
            </button>
            <button
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({ ...filters, since: isoDaysAgo(7), until: undefined });
                close();
              }}
            >
              Last 7 days
            </button>
            <button
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({ ...filters, since: isoDaysAgo(30), until: undefined });
                close();
              }}
            >
              Last 30 days
            </button>
            <div className="h-px my-1 bg-[var(--vscode-menu-separatorBackground,var(--border))]" />
            <button
              type="button"
              className={itemCls}
              onClick={() => setShowDateCustom(true)}
              data-testid="log-filter-date-custom"
            >
              Select...
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${itemCls} flex items-center gap-1`}
              onClick={() => setShowDateCustom(false)}
            >
              <ChevronLeft size={12} aria-hidden />
              Back
            </button>
            <div className="h-px my-1 bg-[var(--vscode-menu-separatorBackground,var(--border))]" />
            <LogDatePicker
              since={filters.since}
              until={filters.until}
              onChange={(next) =>
                onFiltersChange({ ...filters, since: next.since, until: next.until })
              }
            />
          </>
        )}
      </FilterChip>

      <FilterChip
        id="log-filter-path"
        label="Paths"
        value={filters.path}
        open={open === "paths"}
        onToggle={() => toggle("paths")}
        onClose={close}
      >
        <input
          type="text"
          className={fieldCls}
          placeholder="Paths"
          value={pathQuery || filters.path || ""}
          onChange={(e) => {
            setPathQuery(e.target.value);
            onFiltersChange({ ...filters, path: e.target.value });
          }}
          data-testid="log-filter-path"
          autoFocus
        />
        {visiblePaths.slice(0, 8).map((path) => (
          <button
            key={path}
            type="button"
            className={itemCls}
            onClick={() => {
              setPathQuery("");
              onFiltersChange({ ...filters, path });
              close();
            }}
          >
            {path}
          </button>
        ))}
      </FilterChip>

      <div className="relative shrink-0">
        <button
          ref={setSortAnchor}
          type="button"
          className="h-[18px] w-[18px] inline-flex items-center justify-center rounded-sm text-vscode-description hover:bg-list-hover hover:text-foreground"
          title="Sort commits"
          aria-expanded={open === "sort"}
          onClick={(event) => {
            event.stopPropagation();
            toggle("sort");
          }}
          data-testid="log-graph-sort"
        >
          <ListFilter size={14} aria-hidden />
        </button>
        <LogMenuPortal
          open={open === "sort"}
          anchor={sortAnchor}
          onClose={close}
          label="Sort commits"
        >
          {(["date", "topological"] as const).map((sort) => (
            <button
              key={sort}
              type="button"
              className={itemCls}
              onClick={() => {
                onExpandedLinearReset();
                onFiltersChange({ ...filters, graphSort: sort });
                close();
              }}
            >
              {sort === "date" ? "Sort by date" : "Topological"}
            </button>
          ))}
        </LogMenuPortal>
      </div>
      <span className="flex-1 min-w-2" />
    </div>
  );
}
