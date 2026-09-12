import { Button } from "../ui/Button";
import type { CSSProperties } from "react";
import type { BlameLineEntry } from "@gitview/shared/types/blame";
import { formatBlameAnnotationDate } from "../../lib/blameFormat";
import { formatRelativeTime } from "./gitPanelFormat";

type BlameCommitHoverCardProps = {
  line: BlameLineEntry;
  isCurrent: boolean;
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenCommit?: (sha: string) => void;
};

/**
 * Rich tooltip shown when hovering a Git Annotate commit
 * block. Displays the commit short SHA, subject, author + email and a
 * relative/absolute date, plus an optional "Show commit details" action.
 */
export function BlameCommitHoverCard({
  line,
  isCurrent,
  style,
  onMouseEnter,
  onMouseLeave,
  onOpenCommit,
}: BlameCommitHoverCardProps) {
  const date = formatBlameAnnotationDate(line.authorTime);
  const relative = formatRelativeTime(line.authorTime);
  return (
    <div
      role="tooltip"
      data-testid="blame-commit-hover-card"
      className="fixed z-[1000] min-w-blame-hover-min max-w-blame-hover-max px-3 py-2.5 rounded-vscode border border-border bg-hover-bg text-hover-fg shadow-popover font-mono text-xs leading-snug pointer-events-auto animate-blame-hover-fade"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-vscode-link text-xs font-semibold">
          {line.shortSha}
        </span>
        {isCurrent && (
          <span className="text-section px-1.5 py-px rounded-vscode bg-badge-bg text-badge-fg">
            current
          </span>
        )}
      </div>
      <div className="text-xs text-vscode-editor-fg mb-1.5 whitespace-pre-wrap break-words">
        {line.summary}
      </div>
      <div className="text-ui-sm text-vscode-description whitespace-pre-wrap break-words">
        {line.author} &lt;{line.authorEmail}&gt;
      </div>
      <div className="text-ui-sm text-vscode-description whitespace-pre-wrap break-words">
        {relative} · {date}
      </div>
      {onOpenCommit && (
        <div className="mt-2 pt-2 border-t border-border">
          <Button variant="ghost" size="content"
            type="button"
            className="bg-transparent border-0 p-0 text-left text-ui-sm text-vscode-link cursor-pointer hover:underline"
            onClick={() => onOpenCommit(line.sha)}
            data-testid="blame-hover-open-commit"
          >
            Show commit details
          </Button>
        </div>
      )}
    </div>
  );
}
