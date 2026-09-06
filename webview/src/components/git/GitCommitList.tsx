import { Button } from "../ui/Button";
import { useEffect, useMemo, useRef } from "react";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import type { CollapsedLogCommit } from "../../lib/collapseLinearCommits";
import { buildGitLogGraphLayout } from "../../lib/gitLogGraph";
import { GitCommitRow } from "./GitCommitRow";
import { GitLogGraphOverlay } from "./GitLogGraphOverlay";

type GitCommitListProps = {
  entries?: CollapsedLogCommit[];
  commits?: LogCommitEntry[];
  selectedSha: string | null;
  selectedShas?: string[];
  onSelect: (sha: string, multi?: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, commit: LogCommitEntry) => void;
  onExpandCollapsed?: (commits: LogCommitEntry[]) => void;
  issueTrackerBaseUrl?: string | null;
  compactRows?: boolean;
  /** Single-line rows for blame file-history drawer. */
  blameDensity?: boolean;
  /** Git Log rows shown below Annotate. */
  graphDensity?: boolean;
  /** Current / HEAD revision in annotate mode. */
  currentSha?: string | null;
  highlightCurrentBranch?: boolean;
  currentBranchHeadSha?: string | null;
  loading?: boolean;
  emptyLabel?: string;
};

export function GitCommitList({
  entries: entriesProp,
  commits,
  selectedSha,
  selectedShas = [],
  onSelect,
  onContextMenu,
  onExpandCollapsed,
  issueTrackerBaseUrl,
  blameDensity = false,
  graphDensity = false,
  currentSha = null,
  highlightCurrentBranch = false,
  currentBranchHeadSha = null,
  compactRows = false,
  loading,
  emptyLabel = "No commits found.",
}: GitCommitListProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  // Callers pass either shape; rebuilding the fallback on every render would
  // invalidate the graph-layout memo below on lists of thousands of commits.
  const entries = useMemo(
    () =>
      entriesProp ??
      (commits ?? []).map((commit) => ({ kind: "commit" as const, commit })),
    [entriesProp, commits],
  );

  const graphCommits = useMemo(
    () =>
      entries
        .filter(
          (entry): entry is { kind: "commit"; commit: LogCommitEntry } =>
            entry.kind === "commit",
        )
        .map((entry) => entry.commit),
    [entries],
  );
  const graphRowBySha = useMemo(
    () =>
      new Map(
        entries.flatMap((entry, row) =>
          entry.kind === "commit" ? [[entry.commit.sha, row] as const] : [],
        ),
      ),
    [entries],
  );
  const graphLayout = useMemo(
    () =>
      graphDensity
        ? buildGitLogGraphLayout(graphCommits, {
            rowBySha: graphRowBySha,
            rowCount: entries.length,
          })
        : null,
    [entries.length, graphCommits, graphDensity, graphRowBySha],
  );

  useEffect(() => {
    if (typeof selectedRef.current?.scrollIntoView !== "function") {
      return;
    }
    selectedRef.current.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedSha, entries.length]);

  if (loading) {
    return (
      <div className="p-3 text-ui-sm text-vscode-description">
        Loading history…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="p-3 text-ui-sm text-vscode-description"
        data-testid="git-commit-list-empty"
      >
        {emptyLabel}
      </div>
    );
  }

  const list = (
    <ul className="m-0 p-0 list-none" data-testid="git-commit-list">
      {entries.map((entry) => {
        if (entry.kind === "collapsed") {
          const selected = entry.commits.some((c) => c.sha === selectedSha);
          return (
            <li key={`collapsed-${entry.fromSha}-${entry.toSha}`}>
              <Button variant="ghost" size="content"
                type="button"
                className={`w-full text-left border-none cursor-pointer text-ui ${
                  graphDensity
                    ? "h-log-graph-row min-h-log-graph-row py-0 flex items-center"
                    : "px-3 py-2 leading-5"
                } ${
                  selected
                    ? "bg-list-active text-list-activeForeground"
                    : "bg-transparent text-foreground hover:bg-list-hover"
                }`}
                onClick={() => onExpandCollapsed?.(entry.commits)}
                data-testid="git-commit-collapsed"
              >
                <div className="font-mono text-vscode-link">
                  {entry.commits[0]?.shortSha}…
                  {entry.commits[entry.count - 1]?.shortSha}
                </div>
                <div className="truncate font-medium">
                  {entry.count} linear commits
                </div>
                <div
                  className={`truncate text-ui-sm ${
                    selected
                      ? "text-list-activeForeground/80"
                      : "text-vscode-description"
                  }`}
                >
                  Click to expand
                </div>
              </Button>
            </li>
          );
        }

        const commit = entry.commit;
        const selected =
          selectedShas.includes(commit.sha) || commit.sha === selectedSha;
        const current = currentSha === commit.sha;
        return (
          <GitCommitRow
            key={commit.sha}
            commit={commit}
            selected={selected}
            current={current}
            highlighted={
              current ||
              (highlightCurrentBranch && currentBranchHeadSha === commit.sha)
            }
            issueTrackerBaseUrl={issueTrackerBaseUrl}
            blameDensity={blameDensity}
            compact={compactRows}
            graphWidth={graphDensity && graphLayout ? graphLayout.width : null}
            selectedRef={selectedRef}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        );
      })}
    </ul>
  );

  if (graphDensity && graphLayout) {
    return (
      <div className="relative min-h-0" data-testid="git-commit-list-graph">
        <GitLogGraphOverlay commits={graphCommits} layout={graphLayout} />
        {list}
      </div>
    );
  }

  return list;
}
