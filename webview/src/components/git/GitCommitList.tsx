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
  const graphLayout = useMemo(
    () => (graphDensity ? buildGitLogGraphLayout(graphCommits) : null),
    [graphCommits, graphDensity],
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
      <div className="px-[var(--nx-pad-x)] py-1.5 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)]">
        Loading history…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="px-[var(--nx-pad-x)] py-1.5 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)]"
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
              <button
                type="button"
                className={`w-full text-left px-3 py-2 border-none cursor-pointer text-[12px] leading-5 ${
                  selected
                    ? "bg-list-active text-list-activeForeground"
                    : "bg-transparent text-foreground hover:bg-list-hover"
                }`}
                onClick={() => onExpandCollapsed?.(entry.commits)}
                data-testid="git-commit-collapsed"
              >
                <div className="font-mono text-[var(--vscode-textLink-foreground)]">
                  {entry.commits[0]?.shortSha}…
                  {entry.commits[entry.count - 1]?.shortSha}
                </div>
                <div className="truncate font-medium">
                  {entry.count} linear commits
                </div>
                <div
                  className={`truncate text-[11px] ${
                    selected
                      ? "text-list-activeForeground/80"
                      : "text-[var(--vscode-descriptionForeground)]"
                  }`}
                >
                  Click to expand
                </div>
              </button>
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