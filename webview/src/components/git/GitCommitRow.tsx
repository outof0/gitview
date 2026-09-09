import { Button } from "../ui/Button";
import { memo, type RefObject } from "react";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import { parseIssueLinks } from "../../lib/issueLinks";
import { cn } from "../../lib/cn";
import { formatRelativeTime } from "./gitPanelFormat";

type GitCommitRowProps = {
  commit: LogCommitEntry;
  selected: boolean;
  current: boolean;
  highlighted: boolean;
  issueTrackerBaseUrl?: string | null;
  compact?: boolean;
  /** Non-null only in graph mode; drives the leading gutter width. */
  graphWidth: number | null;
  graphColor?: string;
  selectedRef: RefObject<HTMLButtonElement>;
  onSelect: (sha: string, multi?: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, commit: LogCommitEntry) => void;
};

function IssueLinks({
  commit,
  issueTrackerBaseUrl,
  className,
}: {
  commit: LogCommitEntry;
  issueTrackerBaseUrl?: string | null;
  className: string;
}) {
  const links = parseIssueLinks(
    commit.subject,
    issueTrackerBaseUrl ?? undefined,
  );
  if (links.length === 0) {
    return null;
  }
  return (
    <span className={className}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          className="ml-1 text-vscode-link underline"
          onClick={(e) => e.stopPropagation()}
          data-testid={`issue-link-${link.id}`}
        >
          {link.label}
        </a>
      ))}
    </span>
  );
}

/**
 * Memoized: selecting a commit would otherwise re-render every row, and the
 * log can hold thousands. Selection arrives as a boolean, never the sha list.
 */
export const GitCommitRow = memo(function GitCommitRow({
  commit,
  selected,
  current,
  highlighted,
  issueTrackerBaseUrl,
  compact = false,
  graphWidth,
  graphColor,
  selectedRef,
  onSelect,
  onContextMenu,
}: GitCommitRowProps) {
  const handleClick = (e: React.MouseEvent) =>
    onSelect(commit.sha, e.metaKey || e.ctrlKey || e.shiftKey);
  const handleContextMenu = onContextMenu
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu(e, commit);
      }
    : undefined;

  if (graphWidth !== null) {
    const commitDate = new Date(commit.authorTime * 1000);
    const dateLabel = `${commitDate.getDate()}/${commitDate.getMonth() + 1}/${String(commitDate.getFullYear()).slice(-2)}, ${String(commitDate.getHours()).padStart(2, "0")}:${String(commitDate.getMinutes()).padStart(2, "0")}`;

    return (
      <li>
        <Button variant="ghost" size="content"
          type="button"
          className={cn(
            "relative w-full grid items-center gap-0 p-0 border-0 bg-transparent text-vscode-editor-fg cursor-pointer text-left hover:bg-list-hover",
            "h-log-graph-row min-h-log-graph-row text-ui-base leading-log-graph-row",
            compact && "text-xs",
            selected && "bg-list-active text-list-activeForeground",
            !selected &&
              highlighted &&
              "bg-[color-mix(in_srgb,var(--list-hover)_65%,transparent)]",
          )}
          style={{
            gridTemplateColumns: `${graphWidth}px minmax(0,1fr) minmax(0,0.42fr) minmax(0,0.34fr)`,
          }}
          ref={selected ? selectedRef : undefined}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          data-testid={`git-commit-${commit.shortSha}`}
          data-graph-row="true"
          data-current={current ? "true" : undefined}
        >
          <span
            className="relative self-stretch shrink-0"
            style={{ width: graphWidth }}
            aria-hidden="true"
          />
          <span
            className={cn(
              "min-w-0 px-2 flex items-center gap-1.5 overflow-hidden",
              current && "font-bold",
            )}
          >
            {(commit.refs?.length ?? 0) > 0 && (
              <span
                className="flex min-w-0 max-w-[36%] flex-[0_1_auto] items-center gap-1 overflow-hidden text-status-modified"
                style={graphColor ? { color: graphColor } : undefined}
                data-testid="commit-refs"
              >
                {commit.refs!.slice(0, 3).map((ref) => (
                  <span
                    key={ref}
                    className="inline-flex min-w-0 max-w-[8rem] flex-[0_1_auto] items-center gap-1 text-section leading-ref font-medium"
                    title={ref}
                    data-testid={`commit-ref-${ref}`}
                  >
                    <span className="git-log-ref-icon" aria-hidden />
                    <span className="min-w-0 truncate">{ref}</span>
                  </span>
                ))}
              </span>
            )}
            <span
              className="min-w-[4rem] flex-1 truncate"
              data-testid="git-commit-subject"
            >
              {commit.subject}
            </span>
            <IssueLinks
              commit={commit}
              issueTrackerBaseUrl={issueTrackerBaseUrl}
              className="shrink-0"
            />
          </span>
          <span
            className={cn(
              "min-w-0 px-2 font-semibold truncate",
              current && "font-bold",
            )}
          >
            {commit.author}
            {current ? "*" : ""}
          </span>
          <span
            className={cn(
              "min-w-0 px-2 tabular-nums truncate text-vscode-description",
              selected &&
                "text-[color-mix(in_srgb,var(--list-active-foreground)_78%,transparent)]",
            )}
          >
            {dateLabel}
          </span>
        </Button>
      </li>
    );
  }

  // Compact single-line log row: SHA | subject | author · time
  return (
    <li>
      <Button variant="ghost" size="content"
        type="button"
        className={cn(
          "w-full text-left border-none cursor-pointer grid items-center gap-2",
          "h-row min-h-row px-2",
          "text-ui leading-row",
          "grid-cols-[52px_minmax(0,1fr)_minmax(0,0.55fr)]",
          selected
            ? "bg-list-active text-list-activeForeground"
            : highlighted
              ? "bg-list-hover/60 text-foreground"
              : "bg-transparent text-foreground hover:bg-list-hover",
        )}
        ref={selected ? selectedRef : undefined}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        data-testid={`git-commit-${commit.shortSha}`}
      >
        <span className="font-mono text-vscode-link truncate tabular-nums">
          {commit.shortSha}
          {commit.isMerge ? (
            <span className="ml-0.5 text-section opacity-70">
              m
            </span>
          ) : null}
        </span>
        <span className="min-w-0 truncate font-medium">
          {commit.subject}
          <IssueLinks
            commit={commit}
            issueTrackerBaseUrl={issueTrackerBaseUrl}
            className="ml-1"
          />
        </span>
        <span
          className={cn(
            "min-w-0 truncate text-ui-sm text-right",
            selected
              ? "text-list-activeForeground/80"
              : "text-vscode-description",
          )}
        >
          {commit.author} · {formatRelativeTime(commit.authorTime)}
        </span>
      </Button>
    </li>
  );
});
