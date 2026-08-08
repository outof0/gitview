import { GitCommit } from "lucide-react";
import type { GitFileStatus } from "@gitview/shared/types/status";

type CommitPanelProps = {
  files: GitFileStatus[];
  commitScope: Set<string>;
  message: string;
  amend: boolean;
  signoff: boolean;
  gpgSign: boolean;
  author: string;
  runChecks: boolean;
  busy: boolean;
  protectedBranch?: boolean;
  onMessageChange: (value: string) => void;
  onAmendChange: (value: boolean) => void;
  onSignoffChange: (value: boolean) => void;
  onGpgSignChange: (value: boolean) => void;
  onAuthorChange: (value: string) => void;
  onRunChecksChange: (value: boolean) => void;
  onCommit: () => void;
  onCommitAndPush: () => void;
  onRunChecks?: () => void;
};

export function CommitPanel({
  files,
  commitScope,
  message,
  amend,
  signoff,
  gpgSign,
  author,
  runChecks,
  busy,
  protectedBranch = false,
  onMessageChange,
  onAmendChange,
  onSignoffChange,
  onGpgSignChange,
  onAuthorChange,
  onRunChecksChange,
  onCommit,
  onCommitAndPush,
  onRunChecks,
}: CommitPanelProps) {
  const selected = files.filter((file) => commitScope.has(file.path));
  const canCommit = message.trim().length > 0 && selected.length > 0 && !busy;

  return (
    <section
      className="shrink-0 border-t border-border flex flex-col bg-[var(--vscode-editor-background,var(--background))] font-[family-name:var(--nx-font-ui)]"
      data-testid="gitview-commit-panel"
    >
      <div className="px-[var(--nx-pad-x)] h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] flex items-center text-[length:var(--nx-font-size-section)] font-semibold uppercase tracking-wide text-vscode-description border-b border-border">
        Commit
        <span className="ml-1 opacity-70">({selected.length} selected)</span>
      </div>

      <div className="max-h-20 overflow-y-auto px-[var(--nx-pad-x)] py-0.5 text-[length:var(--nx-font-size-ui-sm)] font-mono">
        {selected.length === 0 ? (
          <span className="text-vscode-description">
            Select changes to include in the commit.
          </span>
        ) : (
          selected.map((file) => (
            <div key={file.path} className="truncate" data-testid={`commit-scope-${file.path}`}>
              {file.path}
            </div>
          ))
        )}
      </div>

      <textarea
        className="mx-[var(--nx-pad-x)] my-1.5 min-h-[56px] resize-y rounded-vscode border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] px-2 py-1 text-[length:var(--nx-font-size-ui)] font-sans"
        placeholder="Commit message"
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        data-testid="commit-message"
      />

      <input
        type="text"
        className="mx-[var(--nx-pad-x)] mb-1.5 h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]"
        placeholder="Author override (Name <email@example.com>)"
        value={author}
        onChange={(e) => onAuthorChange(e.target.value)}
        data-testid="commit-author"
      />

      {protectedBranch && (
        <div
          className="mx-[var(--nx-pad-x)] mb-1 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-inputValidation-warningForeground)]"
          data-testid="commit-protected-warning"
        >
          Amend is disabled on protected branches.
        </div>
      )}

      <div className="px-[var(--nx-pad-x)] pb-1.5 flex flex-wrap items-center gap-2 text-[length:var(--nx-font-size-ui-sm)]">
        <label
          className={`flex items-center gap-1.5 ${protectedBranch ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <input
            type="checkbox"
            checked={amend}
            disabled={protectedBranch}
            onChange={(e) => onAmendChange(e.target.checked)}
            data-testid="commit-amend"
          />
          Amend
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={signoff}
            onChange={(e) => onSignoffChange(e.target.checked)}
            data-testid="commit-signoff"
          />
          Sign-off
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={gpgSign}
            onChange={(e) => onGpgSignChange(e.target.checked)}
            data-testid="commit-gpg-sign"
          />
          GPG sign
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={runChecks}
            onChange={(e) => onRunChecksChange(e.target.checked)}
            data-testid="commit-run-checks"
          />
          Run checks
        </label>
      </div>

      <div className="px-[var(--nx-pad-x)] pb-2 flex gap-1.5 flex-wrap">
        <button
          type="button"
          className="h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2.5 flex items-center gap-1 text-[length:var(--nx-font-size-ui)] rounded-vscode bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          disabled={!canCommit}
          onClick={onCommit}
          data-testid="commit-button"
        >
          <GitCommit size={14} aria-hidden />
          Commit
        </button>
        <button
          type="button"
          className="h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-50"
          disabled={!canCommit}
          onClick={onCommitAndPush}
          data-testid="commit-and-push-button"
        >
          Commit and Push
        </button>
        {onRunChecks && (
          <button
            type="button"
            className="h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-50"
            disabled={selected.length === 0 || busy}
            onClick={onRunChecks}
            data-testid="commit-checks-button"
          >
            Check
          </button>
        )}
      </div>
    </section>
  );
}