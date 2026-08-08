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
      className="fixed z-[1000] min-w-[240px] max-w-[340px] px-3 py-2.5 rounded-vscode border border-border bg-[var(--vscode-editorHoverWidget-background,var(--menu-bg,#252526))] text-[var(--vscode-editorHoverWidget-foreground,var(--vscode-editor-foreground,#cccccc))] shadow-[0_4px_14px_rgba(0,0,0,0.4)] font-mono text-xs leading-snug pointer-events-auto animate-blame-hover-fade"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[var(--vscode-textLink-foreground,#3794ff)] text-xs font-semibold">
          {line.shortSha}
        </span>
        {isCurrent && (
          <span className="text-[10px] px-1.5 py-px rounded-vscode bg-[var(--vscode-badge-background,#4d4d4d)] text-[var(--vscode-badge-foreground,#ffffff)]">
            current
          </span>
        )}
      </div>
      <div className="text-xs text-[var(--vscode-editor-foreground,#d4d4d4)] mb-1.5 whitespace-pre-wrap break-words">
        {line.summary}
      </div>
      <div className="text-[11px] text-[var(--vscode-descriptionForeground,#9d9d9d)] whitespace-pre-wrap break-words">
        {line.author} &lt;{line.authorEmail}&gt;
      </div>
      <div className="text-[11px] text-[var(--vscode-descriptionForeground,#9d9d9d)] whitespace-pre-wrap break-words">
        {relative} · {date}
      </div>
      {onOpenCommit && (
        <div className="mt-2 pt-2 border-t border-border">
          <button
            type="button"
            className="bg-transparent border-0 p-0 text-left text-[11px] text-[var(--vscode-textLink-foreground,#3794ff)] cursor-pointer hover:underline"
            onClick={() => onOpenCommit(line.sha)}
            data-testid="blame-hover-open-commit"
          >
            Show commit details
          </button>
        </div>
      )}
    </div>
  );
}