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
  blameDensity: boolean;
  /** Non-null only in graph mode; drives the leading gutter width. */
  graphWidth: number | null;
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
          className="ml-1 text-[var(--vscode-textLink-foreground)] underline"
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
  blameDensity,
  graphWidth,
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
        <button
          type="button"
          className={cn(
            "relative w-full min-h-6 grid items-center gap-0 p-0 border-0 bg-transparent text-vscode-editor-fg cursor-pointer text-left text-xs leading-6 hover:bg-list-hover",
            selected && "bg-list-active text-list-activeForeground",
            !selected &&
              highlighted &&
              "bg-[color-mix(in_srgb,var(--vscode-list-hoverBackground,rgba(255,255,255,0.08))_65%,transparent)]",
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
            <span className="truncate min-w-0">{commit.subject}</span>
            <IssueLinks
              commit={commit}
              issueTrackerBaseUrl={issueTrackerBaseUrl}
              className="shrink-0"
            />
            {(commit.refs?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 shrink-0 max-w-[40%] overflow-hidden">
                {commit.refs!.slice(0, 3).map((ref) => (
                  <span
                    key={ref}
                    className={cn(
                      "inline-flex items-center max-w-[7rem] truncate px-1 rounded-[2px] text-[10px] leading-[16px] font-medium",
                      "border border-[var(--vscode-gitDecoration-modifiedResourceForeground,#3887c7)]",
                      "text-[var(--vscode-gitDecoration-modifiedResourceForeground,#3887c7)]",
                      "bg-[color-mix(in_srgb,var(--vscode-gitDecoration-modifiedResourceForeground,#3887c7)_12%,transparent)]",
                    )}
                    title={ref}
                    data-testid={`commit-ref-${ref}`}
                  >
                    {ref}
                  </span>
                ))}
              </span>
            )}
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
                "text-[color-mix(in_srgb,var(--vscode-list-activeSelectionForeground,#ffffff)_78%,transparent)]",
            )}
          >
            {dateLabel}
          </span>
        </button>
      </li>
    );
  }

  if (blameDensity) {
    return (
      <li>
        <button
          type="button"
          className={cn(
            "w-full text-left border-none cursor-pointer grid grid-cols-[62px_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 items-center min-h-5 py-px px-2 text-[11px] leading-[18px] text-foreground bg-transparent",
            selected
              ? "bg-list-active text-list-activeForeground"
              : "hover:bg-list-hover",
          )}
          ref={selected ? selectedRef : undefined}
          onClick={handleClick}
          data-testid={`git-commit-${commit.shortSha}`}
        >
          <span
            className={cn(
              "font-editor text-vscode-link",
              selected && "text-inherit",
            )}
          >
            {commit.shortSha}
          </span>
          <span className="font-medium truncate">{commit.subject}</span>
          <span
            className={cn(
              "text-[10px] text-vscode-description truncate",
              selected &&
                "text-[color-mix(in_srgb,currentColor_78%,transparent)]",
            )}
          >
            {commit.author} · {formatRelativeTime(commit.authorTime)}
          </span>
        </button>
      </li>
    );
  }

  // Compact single-line log row: SHA | subject | author · time
  return (
    <li>
      <button
        type="button"
        className={cn(
          "w-full text-left border-none cursor-pointer grid items-center gap-2",
          "h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2",
          "text-[length:var(--nx-font-size-ui)] leading-[var(--nx-row-h)]",
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
        <span className="font-mono text-[var(--vscode-textLink-foreground)] truncate tabular-nums">
          {commit.shortSha}
          {commit.isMerge ? (
            <span className="ml-0.5 text-[10px] opacity-70">m</span>
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
            "min-w-0 truncate text-[length:var(--nx-font-size-ui-sm)] text-right",
            selected
              ? "text-list-activeForeground/80"
              : "text-[var(--vscode-descriptionForeground)]",
          )}
        >
          {commit.author} · {formatRelativeTime(commit.authorTime)}
        </span>
      </button>
    </li>
  );
});
