import { Button } from "../../ui/Button";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ListFilter, Search } from "lucide-react";
import type { LogQueryFilters, LogQueryRange } from "@gitview/shared/types/log";
import { LogMenuPortal } from "./logMenuPortal";
import { LogDatePicker } from "./LogDatePicker";
import { isoDaysAgo } from "./localIsoDate";
import { TextField } from "../../ui/TextField";

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
  "h-6 px-2 inline-flex items-center gap-1 rounded-vscode text-ui-base leading-none hover:bg-list-hover shrink-0 pointer-events-auto";
const itemCls =
  "min-h-menu-item px-menu-pad-x py-menu-pad-y w-full min-w-0 truncate text-left text-ui leading-none text-menu-fg hover:bg-menu-selection hover:text-menu-selectionForeground disabled:opacity-40 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset";

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
      <Button variant="ghost" size="content"
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
        <span className="max-w-filter-value truncate">{value || label}</span>
        <ChevronDown
          size={12}
          aria-hidden
          className="text-vscode-description"
        />
      </Button>
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
    <div
      className="flex items-center gap-2 min-w-0 flex-1 flex-wrap"
      data-testid="log-filters"
    >
      <TextField
        type="search"
        aria-label="Search commits"
        containerClassName="w-log-search max-w-log-search shrink-0"
        leading={<Search size={14} />}
        trailing={
          <>
            <Button variant="ghost" size="content"
              type="button"
              className={`h-5 w-row shrink-0 text-center text-section leading-none rounded-vscode ${regex ? "bg-list-active text-list-activeForeground" : "text-foreground hover:bg-toolbar-hover"}`}
              aria-pressed={regex}
              title="Regular expression"
              onClick={() => setRegex((v) => !v)}
              data-testid="log-filter-regex"
            >
              .*
            </Button>
            <Button variant="ghost" size="content"
              type="button"
              className={`h-5 w-row shrink-0 text-center text-micro leading-none rounded-vscode ${matchCase ? "bg-list-active text-list-activeForeground" : "text-foreground hover:bg-toolbar-hover"}`}
              aria-pressed={matchCase}
              title="Match case"
              onClick={() => setMatchCase((v) => !v)}
              data-testid="log-filter-case"
            >
              Cc
            </Button>
          </>
        }
        placeholder="Text or hash"
        value={filters.grep ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, grep: e.target.value })}
        data-testid="log-filter-grep"
      />

      <FilterChip
        id="log-filter-branch"
        label="Branch"
        value={branchChipValue}
        open={open === "branch"}
        onToggle={() => toggle("branch")}
        onClose={close}
      >
        <TextField
          type="search"
          containerClassName="w-full"
          aria-label="Filter branches"
          placeholder="Filter branches"
          value={branchQuery || filters.branch || ""}
          onChange={(e) => {
            setBranchQuery(e.target.value);
            onFiltersChange({
              ...filters,
              branch: e.target.value,
              range: "all",
            });
          }}
          data-testid="log-filter-branch"
          autoFocus
        />
        {(["all", "incoming", "outgoing"] as const).map((range) => (
          <Button variant="ghost" size="content"
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
            {range === "all"
              ? "All commits"
              : range === "incoming"
                ? "Incoming"
                : "Outgoing"}
          </Button>
        ))}
        <div className="h-px my-1 bg-menu-separator" />
        {visibleBranches.map((name) => (
          <Button variant="ghost" size="content"
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
          </Button>
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
        <TextField
          type="search"
          containerClassName="w-full"
          aria-label="Filter authors"
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
          <Button variant="ghost" size="content"
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
          </Button>
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
            <Button variant="ghost" size="content"
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  since: undefined,
                  until: undefined,
                });
                close();
              }}
            >
              Any date
            </Button>
            <Button variant="ghost" size="content"
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  since: isoDaysAgo(1),
                  until: undefined,
                });
                close();
              }}
            >
              Last 24 hours
            </Button>
            <Button variant="ghost" size="content"
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  since: isoDaysAgo(7),
                  until: undefined,
                });
                close();
              }}
            >
              Last 7 days
            </Button>
            <Button variant="ghost" size="content"
              type="button"
              className={itemCls}
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  since: isoDaysAgo(30),
                  until: undefined,
                });
                close();
              }}
            >
              Last 30 days
            </Button>
            <div className="h-px my-1 bg-menu-separator" />
            <Button variant="ghost" size="content"
              type="button"
              className={itemCls}
              onClick={() => setShowDateCustom(true)}
              data-testid="log-filter-date-custom"
            >
              Select...
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="content"
              type="button"
              className={`${itemCls} flex items-center gap-1`}
              onClick={() => setShowDateCustom(false)}
            >
              <ChevronLeft size={12} aria-hidden />
              Back
            </Button>
            <div className="h-px my-1 bg-menu-separator" />
            <LogDatePicker
              since={filters.since}
              until={filters.until}
              onChange={(next) =>
                onFiltersChange({
                  ...filters,
                  since: next.since,
                  until: next.until,
                })
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
        <TextField
          type="search"
          containerClassName="w-full"
          aria-label="Filter paths"
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
          <Button variant="ghost" size="content"
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
          </Button>
        ))}
      </FilterChip>

      <div className="relative shrink-0">
        <Button variant="ghost" size="content"
          ref={setSortAnchor}
          type="button"
          className="h-icon-lg w-icon-lg inline-flex items-center justify-center rounded-vscode text-vscode-description hover:bg-list-hover hover:text-foreground"
          title="Sort commits"
          aria-expanded={open === "sort"}
          onClick={(event) => {
            event.stopPropagation();
            toggle("sort");
          }}
          data-testid="log-graph-sort"
        >
          <ListFilter size={14} aria-hidden />
        </Button>
        <LogMenuPortal
          open={open === "sort"}
          anchor={sortAnchor}
          onClose={close}
          label="Sort commits"
        >
          {(["date", "topological"] as const).map((sort) => (
            <Button variant="ghost" size="content"
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
            </Button>
          ))}
        </LogMenuPortal>
      </div>
      <span className="flex-1 min-w-2" />
    </div>
  );
}
