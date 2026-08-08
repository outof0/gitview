import type { GitCommitEntry } from "@gitview/types";
import { cn } from "../../lib/cn";
import { HighlightedCodeLine } from "./HighlightedCodeLine";
import { formatRelativeTime, statusBadge } from "./gitPanelFormat";

type GitCommitDetailProps = {
  commit: GitCommitEntry | null;
  highlightPath?: string;
  previewText?: string;
  /** Repo-relative path — drives syntax colors in revision preview. */
  filePath?: string;
  /**
   * Log details pane (JB git_log_view.png): message + author only.
   * Files live in the separate Changed Files pane above.
   */
  detailsOnly?: boolean;
};

function HighlightedCodeBlock({
  text,
  filePath,
}: {
  text: string;
  filePath?: string;
}) {
  const lines = text.split("\n");
  return (
    <div className="flex-1 min-h-0 m-0 py-2.5 px-3 overflow-auto bg-vscode-editor-bg text-vscode-editor-fg font-editor text-editor leading-5">
      {lines.map((line, i) => (
        <div key={i} className="nx-diff-hover-line relative min-h-[18px] whitespace-pre">
          <HighlightedCodeLine text={line} filePath={filePath} />
        </div>
      ))}
    </div>
  );
}

export function GitCommitDetail({
  commit,
  highlightPath,
  previewText,
  filePath,
  detailsOnly = false,
}: GitCommitDetailProps) {
  if (!commit) {
    if (previewText !== undefined) {
      return (
        <div
          className="flex flex-col min-h-0 h-full"
          data-testid="git-commit-detail"
        >
          <div className="shrink-0 py-2 px-2.5 border-b border-border text-xs text-vscode-description">
            Select a commit to view details.
          </div>
          <HighlightedCodeBlock text={previewText} filePath={filePath} />
        </div>
      );
    }
    return (
      <div
        className="p-3 text-[length:var(--nx-font-size-ui-sm)] text-vscode-description"
        data-testid="git-commit-detail"
      >
        Select a commit to view details.
      </div>
    );
  }

  const header = (
    <div
      className={cn(
        "shrink-0 py-2.5 px-3",
        !detailsOnly && "border-b border-border bg-vscode-widget-bg",
      )}
    >
      <div className="text-[13px] font-semibold leading-[18px] text-foreground">
        {commit.subject}
      </div>
      {commit.body ? (
        <pre className="mt-1.5 m-0 text-xs leading-[17px] text-vscode-description whitespace-pre-wrap font-sans">
          {commit.body}
        </pre>
      ) : null}
      <div className="mt-1.5 text-[11px] leading-4 text-vscode-description">
        <span className="font-mono text-vscode-link">{commit.shortSha}</span>{" "}
        {commit.author}
        {commit.authorEmail ? (
          <>
            {" "}
            &lt;{commit.authorEmail}&gt;
          </>
        ) : null}{" "}
        on {formatRelativeTime(commit.authorTime)}
      </div>
    </div>
  );

  if (detailsOnly) {
    return (
      <div
        className="flex flex-col min-h-0 h-full overflow-auto"
        data-testid="git-commit-detail"
      >
        {header}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-0 h-full"
      data-testid="git-commit-detail"
    >
      {header}

      <div className="grid flex-1 min-h-0 grid-cols-[minmax(190px,0.85fr)_minmax(0,1.15fr)] max-[780px]:grid-cols-1 max-[780px]:grid-rows-[minmax(88px,34%)_minmax(0,1fr)]">
        <div className="min-w-0 min-h-0 overflow-auto border-r border-border max-[780px]:border-r-0 max-[780px]:border-b max-[780px]:border-border">
          <div className="flex items-center min-h-7 px-2.5 border-b border-border text-[11px] font-semibold text-vscode-description">
            Changed files
          </div>
          <ul className="m-0 p-0 list-none text-[12px]">
            {commit.changedFiles.map((f) => {
              const hit =
                highlightPath &&
                (f.path === highlightPath ||
                  f.path.endsWith(`/${highlightPath}`));
              return (
                <li
                  key={`${commit.sha}-${f.path}`}
                  className={cn(
                    "flex items-center gap-1.5 min-h-6 px-2.5 overflow-hidden font-editor leading-6 text-vscode-editor-fg",
                    hit &&
                      "bg-[color-mix(in_srgb,var(--vscode-list-activeSelectionBackground,#2f4f87)_28%,transparent)] text-vscode-link",
                  )}
                >
                  <span className="shrink-0 w-[18px] text-[11px] text-center text-vscode-description">
                    {statusBadge(f.status)}
                  </span>
                  <span className="truncate">{f.path}</span>
                </li>
              );
            })}
            {commit.changedFiles.length === 0 && (
              <li className="px-3 py-2 text-vscode-description">
                No file changes recorded.
              </li>
            )}
          </ul>
        </div>

        {previewText !== undefined && (
          <div className="flex flex-col min-w-0 min-h-0 overflow-hidden">
            <div className="flex items-center min-h-7 px-2.5 border-b border-border text-[11px] font-semibold text-vscode-description">
              Revision preview
            </div>
            <HighlightedCodeBlock text={previewText} filePath={filePath} />
          </div>
        )}
      </div>
    </div>
  );
}