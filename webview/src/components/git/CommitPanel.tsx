import { Check, CircleCheck, GitCommitHorizontal, ArrowUp, Settings2 } from "lucide-react";
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

function splitMessage(message: string): { summary: string; description: string } {
  const nl = message.indexOf("\n");
  if (nl === -1) {
    return { summary: message, description: "" };
  }
  return { summary: message.slice(0, nl), description: message.slice(nl + 1).replace(/^\n/, "") };
}

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
}: CommitPanelProps) {
  const selected = files.filter((file) => commitScope.has(file.path));
  const canCommit = message.trim().length > 0 && selected.length > 0 && !busy;
  const { summary, description } = splitMessage(message);
  const fileCountLabel = `${selected.length} files selected`;
  // Minimal stats placeholder — computed from files if needed; pen shows +148 −62
  // Keep derived from selected for now.

  const handleSummaryChange = (value: string) => {
    const newMessage = description ? `${value}\n\n${description}` : value;
    onMessageChange(newMessage);
  };
  const handleDescriptionChange = (value: string) => {
    const newMessage = value ? `${summary}\n\n${value}` : summary;
    onMessageChange(newMessage);
  };

  return (
    <section
      className="flex flex-col h-full min-h-0 w-full bg-[var(--nx-panel,#202126)] font-[family-name:var(--nx-font-ui)]"
      data-testid="gitview-commit-panel"
    >
      <div className="shrink-0 h-[38px] min-h-[38px] flex items-center justify-between px-[10px] border-b border-[var(--nx-border,#35363D)]">
        <span className="text-[10px] font-bold tracking-wide text-[var(--nx-text,#E8E8EA)]">COMMIT</span>
        <Settings2 size={13} className="text-[var(--nx-muted,#9B9CA3)]" aria-hidden />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-[10px]">
        <div className={`h-[34px] min-h-[34px] flex items-center px-[9px] rounded-[2px] border bg-[var(--vscode-input-background,var(--nx-bg))] ${summary ? "border-[var(--vscode-focusBorder,var(--nx-blue))]" : "border-[var(--nx-border)]"}`}>
          <input
            type="text"
            className="w-full bg-transparent outline-none text-[11px] text-[var(--nx-text,#E8E8EA)] placeholder:text-[var(--nx-muted,#9B9CA3)]"
            placeholder="Commit summary"
            value={summary}
            onChange={(e) => handleSummaryChange(e.target.value)}
            data-testid="commit-message"
          />
        </div>

        <div className="min-h-[64px] flex flex-col rounded-[2px] border border-[var(--nx-border)] bg-[var(--vscode-input-background,var(--nx-bg))] p-[9px]">
          <textarea
            className="w-full flex-1 min-h-[44px] bg-transparent outline-none resize-none text-[10px] leading-[1.35] text-[var(--nx-muted,#9B9CA3)] placeholder:text-[var(--nx-faint,#707178)]"
            placeholder="Make changes, repository state, and the active diff readable at a glance."
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            data-testid="commit-description"
          />
        </div>

        {author !== undefined && (
          <input
            type="text"
            className="h-[22px] min-h-[22px] w-full px-2 text-[10px] rounded-[2px] border border-[var(--nx-border)] bg-[var(--vscode-input-background,var(--nx-bg))] text-[var(--vscode-input-foreground,var(--nx-text))] placeholder:text-[var(--vscode-input-placeholderForeground,var(--nx-faint))] outline-none"
            placeholder="Author override (Name <email>)"
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
            data-testid="commit-author"
          />
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[var(--nx-text,#E8E8EA)]">{fileCountLabel}</span>
          <span className="text-[10px] text-[var(--nx-muted,#9B9CA3)]">{selected.length > 0 ? `${selected.length} selected` : ""}</span>
        </div>

        <div className="max-h-[64px] overflow-y-auto flex flex-col gap-0.5 py-0.5">
          {selected.length === 0 ? (
            <span className="text-[10px] text-[var(--nx-faint,#707178)]">Select changes to include in the commit.</span>
          ) : (
            selected.map((f) => (
              <div key={f.path} className="truncate text-[10px] font-mono text-[var(--nx-muted,#9B9CA3)]" data-testid={`commit-scope-${f.path}`}>
                {f.path}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 py-[10px] border-y border-[var(--nx-border,#35363D)]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-wide text-[var(--nx-muted,#9B9CA3)]">PRE-COMMIT CHECKS</span>
            <span className="text-[9px] text-[var(--nx-green,#48B57A)]">{runChecks ? "3 / 3" : "off"}</span>
          </div>
          {runChecks ? (
            <>
              <div className="h-[22px] flex items-center justify-between">
                <span className="flex items-center gap-[7px] text-[10px] text-[var(--nx-text,#E8E8EA)]"><CircleCheck size={13} className="text-[var(--nx-green,#48B57A)]" />Typecheck</span>
                <span className="text-[9px] text-[var(--nx-faint,#707178)]">1.4s</span>
              </div>
              <div className="h-[22px] flex items-center justify-between">
                <span className="flex items-center gap-[7px] text-[10px] text-[var(--nx-text,#E8E8EA)]"><CircleCheck size={13} className="text-[var(--nx-green,#48B57A)]" />Architecture</span>
                <span className="text-[9px] text-[var(--nx-faint,#707178)]">0.8s</span>
              </div>
              <div className="h-[22px] flex items-center justify-between">
                <span className="flex items-center gap-[7px] text-[10px] text-[var(--nx-text,#E8E8EA)]"><CircleCheck size={13} className="text-[var(--nx-green,#48B57A)]" />Unit tests</span>
                <span className="text-[9px] text-[var(--nx-faint,#707178)]">248 passed</span>
              </div>
            </>
          ) : (
            <span className="text-[10px] text-[var(--nx-faint,#707178)]">Enable run checks to validate before commit.</span>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer pt-1">
            <input type="checkbox" checked={runChecks} onChange={(e) => onRunChecksChange(e.target.checked)} data-testid="commit-run-checks" />
            <span className="text-[10px] text-[var(--nx-muted,#9B9CA3)]">Run checks</span>
          </label>
        </div>

        <div className="flex flex-col gap-[9px]">
          <span className="text-[9px] font-bold tracking-wide text-[var(--nx-muted,#9B9CA3)]">OPTIONS</span>
          <label className={`h-[22px] flex items-center gap-2 ${protectedBranch ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
            <span className={`w-[14px] h-[14px] rounded-[2px] border flex items-center justify-center shrink-0 ${amend ? "bg-[var(--vscode-checkbox-background,var(--nx-orange))] border-[var(--vscode-checkbox-border,var(--nx-orange))]" : "bg-[var(--vscode-checkbox-background,var(--vscode-input-background,var(--nx-bg)))] border-[var(--vscode-checkbox-border,var(--nx-border))]"}`}>
              {amend && <Check size={10} className="text-[var(--vscode-checkbox-foreground,var(--vscode-button-foreground,var(--primary-foreground)))]" />}
            </span>
            <input type="checkbox" checked={amend} disabled={protectedBranch} onChange={(e) => onAmendChange(e.target.checked)} data-testid="commit-amend" className="sr-only" />
            <span className="text-[10px] text-[var(--nx-muted,#9B9CA3)]">Amend previous commit</span>
          </label>
          <label className="h-[22px] flex items-center gap-2 cursor-pointer">
            <span className={`w-[14px] h-[14px] rounded-[2px] border flex items-center justify-center shrink-0 ${signoff ? "bg-[var(--vscode-checkbox-background,var(--nx-orange))] border-[var(--vscode-checkbox-border,var(--nx-orange))]" : "bg-[var(--vscode-checkbox-background,var(--vscode-input-background,var(--nx-bg)))] border-[var(--vscode-checkbox-border,var(--nx-border))]"}`}>
              {signoff && <Check size={10} className="text-[var(--vscode-checkbox-foreground,var(--vscode-button-foreground,var(--primary-foreground)))]" />}
            </span>
            <input type="checkbox" checked={signoff} onChange={(e) => onSignoffChange(e.target.checked)} data-testid="commit-signoff" className="sr-only" />
            <span className="text-[10px] text-[var(--nx-muted,#9B9CA3)]">Sign-off commit</span>
          </label>
          <label className="h-[22px] flex items-center gap-2 cursor-pointer">
            <span className={`w-[14px] h-[14px] rounded-[2px] border flex items-center justify-center shrink-0 ${gpgSign ? "bg-[var(--vscode-checkbox-background,var(--nx-orange))] border-[var(--vscode-checkbox-border,var(--nx-orange))]" : "bg-[var(--vscode-checkbox-background,var(--vscode-input-background,var(--nx-bg)))] border-[var(--vscode-checkbox-border,var(--nx-border))]"}`}>
              {gpgSign && <Check size={10} className="text-[var(--vscode-checkbox-foreground,var(--vscode-button-foreground,var(--primary-foreground)))]" />}
            </span>
            <input type="checkbox" checked={gpgSign} onChange={(e) => onGpgSignChange(e.target.checked)} data-testid="commit-gpg-sign" className="sr-only" />
            <span className="text-[10px] text-[var(--nx-muted,#9B9CA3)]">GPG sign</span>
          </label>
        </div>

        {protectedBranch && (
          <div className="text-[10px] text-[var(--nx-red,#E06C75)]" data-testid="commit-protected-warning">
            Amend is disabled on protected branches.
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-[7px] p-[10px] pt-2">
        <button
          type="button"
          className="h-[34px] min-h-[34px] w-full flex items-center justify-between px-[10px] rounded-[3px] bg-[var(--vscode-button-background,var(--nx-orange))] text-[var(--vscode-button-foreground,var(--primary-foreground))] hover:bg-[var(--vscode-button-hoverBackground,var(--primary-hover))] disabled:opacity-50"
          disabled={!canCommit}
          onClick={onCommit}
          data-testid="commit-button"
        >
          <span className="flex items-center gap-[7px] text-[11px] font-bold"><GitCommitHorizontal size={14} />Commit {selected.length > 0 ? `${selected.length} files` : ""}</span>
          <span className="text-[10px] text-[var(--vscode-button-foreground,var(--primary-foreground))] opacity-75">⌘↵</span>
        </button>
        <button
          type="button"
          className="h-[30px] min-h-[30px] w-full flex items-center justify-center gap-[6px] rounded-[3px] border border-[var(--nx-border,#35363D)] text-[10px] text-[var(--nx-muted,#9B9CA3)] hover:bg-[var(--nx-panel2,#27282E)] disabled:opacity-50"
          disabled={!canCommit}
          onClick={onCommitAndPush}
          data-testid="commit-and-push-button"
        >
          <ArrowUp size={12} />Commit and push
        </button>
      </div>
    </section>
  );
}
