import { Button } from "../ui/Button";
import { ChevronDown, ChevronRight, GitBranch, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";

export type LogBranchTreeProps = {
  branches: string[];
  currentBranch?: string | null;
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  /** Optional favorite full names (JB star). */
  favorites?: string[];
  /** Default section expansion (false = collapsed groups). */
  defaultSectionsOpen?: boolean;
};

function splitBranches(branches: string[]) {
  const local: string[] = [];
  const remote: string[] = [];
  for (const b of branches) {
    if (!b || b === "HEAD") {
      continue;
    }
    if (b.includes("/") && (b.startsWith("origin/") || b.startsWith("remotes/"))) {
      remote.push(b.replace(/^remotes\//, ""));
    } else if (b.startsWith("origin/")) {
      remote.push(b);
    } else {
      local.push(b);
    }
  }
  // Heuristic: names with slash that look remote
  const localFiltered = local.filter((b) => !b.startsWith("origin/"));
  return {
    local: [...new Set(localFiltered)].sort(),
    remote: [...new Set(remote)].sort(),
  };
}

/**
 * Left branch tree for Log (JB git_log_view.png: Local / Remote groups).
 */
export function LogBranchTree({
  branches,
  currentBranch,
  selectedBranch,
  onSelectBranch,
  favorites = [],
  defaultSectionsOpen = false,
}: LogBranchTreeProps) {
  const [localOpen, setLocalOpen] = useState(defaultSectionsOpen);
  const [remoteOpen, setRemoteOpen] = useState(defaultSectionsOpen);
  const { local, remote } = useMemo(
    () => splitBranches(branches),
    [branches],
  );
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const renderRow = (name: string) => {
    const selected = selectedBranch === name;
    const current = currentBranch === name;
    const fav = favSet.has(name);
    return (
      <Button variant="ghost" size="content"
        key={name}
        type="button"
        className={cn(
          "w-full flex items-center gap-1.5 text-left border-0 cursor-pointer",
          "h-row min-h-row px-2 pl-5",
          "text-ui truncate",
          selected
            ? "bg-list-active text-list-activeForeground"
            : "bg-transparent text-foreground hover:bg-list-hover",
        )}
        onClick={() => onSelectBranch(name)}
        data-testid={`log-branch-${name}`}
        title={name}
      >
        {fav ? (
          <Star
            size={12}
            className="shrink-0 text-vscode-link"
            fill="currentColor"
            aria-hidden
          />
        ) : (
          <GitBranch size={12} className="shrink-0 opacity-70" aria-hidden />
        )}
        <span className="truncate">
          {name}
          {current ? (
            <span className="ml-1 opacity-60 text-section">
              current
            </span>
          ) : null}
        </span>
      </Button>
    );
  };

  return (
    <div
      className="h-full min-h-0 w-full overflow-y-auto bg-vscode-sidebar-bg text-foreground font-ui"
      data-testid="log-branch-tree"
    >
      <div className="px-2 py-1">
        <Button variant="ghost" size="content"
          type="button"
          className="w-full flex items-center gap-1 h-tree-section px-1 text-ui-sm font-semibold text-vscode-description border-0 bg-transparent cursor-pointer hover:bg-list-hover rounded-vscode"
          onClick={() => setLocalOpen((o) => !o)}
        >
          {localOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Local
        </Button>
        {localOpen ? local.map(renderRow) : null}
      </div>
      {remote.length > 0 ? (
        <div className="px-2 py-1">
          <Button variant="ghost" size="content"
            type="button"
            className="w-full flex items-center gap-1 h-tree-section px-1 text-ui-sm font-semibold text-vscode-description border-0 bg-transparent cursor-pointer hover:bg-list-hover rounded-vscode"
            onClick={() => setRemoteOpen((o) => !o)}
          >
            {remoteOpen ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            Remote
          </Button>
          {remoteOpen ? remote.map(renderRow) : null}
        </div>
      ) : null}
    </div>
  );
}
