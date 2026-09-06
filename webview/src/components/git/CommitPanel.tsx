import { Input } from "../ui/Input";
import { TextArea } from "../ui/TextArea";
import { Button } from "../ui/Button";
import { GitCommitHorizontal, ArrowUp, Settings2 } from "lucide-react";
import { Checkbox } from "../ui/Checkbox";
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
  onRunChecks,
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
      className="flex flex-col h-full min-h-0 w-full bg-panel-bg font-ui"
      data-testid="gitview-commit-panel"
    >
      <div className="shrink-0 h-header min-h-header flex items-center justify-between px-pad-panel border-b border-nx-border">
        <span className="text-section font-bold tracking-wide text-fg">COMMIT</span>
        <Settings2 size={14} className="text-vscode-description" aria-hidden />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-pad-panel">
        <div className={`h-control-lg min-h-control-lg flex items-center px-commit-field rounded-vscode border bg-input ${summary ? "border-ring" : "border-nx-border"}`}>
          <Input
            type="text"
            className="w-full bg-transparent outline-none text-ui-sm text-fg placeholder:text-vscode-description"
            placeholder="Commit summary"
            value={summary}
            onChange={(e) => handleSummaryChange(e.target.value)}
            data-testid="commit-message"
          />
        </div>

        <div className="min-h-commit-message flex flex-col rounded-vscode border border-nx-border bg-input p-commit-field">
          <TextArea
            className="w-full flex-1 min-h-commit-body-min bg-transparent outline-none resize-none text-section leading-[1.35] text-vscode-description placeholder:text-faint"
            placeholder="Make changes, repository state, and the active diff readable at a glance."
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            data-testid="commit-description"
          />
        </div>

        {author !== undefined && (
          <Input
            type="text"
            className="h-row min-h-row w-full px-2 text-section rounded-vscode border border-nx-border bg-input text-input-foreground placeholder:text-control-placeholder outline-none"
            placeholder="Author override (Name <email>)"
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
            data-testid="commit-author"
          />
        )}

        <div className="flex items-center justify-between">
          <span className="text-section font-semibold text-fg">{fileCountLabel}</span>
          <span className="text-section text-vscode-description">{selected.length > 0 ? `${selected.length} selected` : ""}</span>
        </div>

        <div className="max-h-commit-scope overflow-y-auto flex flex-col gap-0.5 py-0.5">
          {selected.length === 0 ? (
            <span className="text-section text-faint">Select changes to include in the commit.</span>
          ) : (
            selected.map((f) => (
              <div key={f.path} className="truncate text-section font-mono text-vscode-description" data-testid={`commit-scope-${f.path}`}>
                {f.path}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 py-pad-panel border-y border-nx-border">
          <div className="flex items-center justify-between">
            <span className="text-micro font-bold tracking-wide text-vscode-description">PRE-COMMIT CHECKS</span>
            <span className="text-micro text-vscode-description">{runChecks ? "runs on commit" : "off"}</span>
          </div>
          {runChecks ? (
            <>
              <span className="text-section text-vscode-description" data-testid="commit-checks-not-run">
                No checks have run yet. They run automatically before commit, or run them now.
              </span>
              <Button variant="ghost" size="content"
                type="button"
                className="h-control min-h-control w-full flex items-center justify-center gap-control-gap rounded-vscode border border-nx-border text-section text-vscode-description hover:bg-vscode-widget-bg disabled:opacity-40"
                disabled={busy || !onRunChecks}
                onClick={() => onRunChecks?.()}
                data-testid="commit-run-checks-now"
              >
                Run checks now
              </Button>
            </>
          ) : (
            <span className="text-section text-faint">Enable run checks to validate before commit.</span>
          )}
          <Checkbox
            className="pt-1 text-section text-vscode-description"
            checked={runChecks}
            onChange={onRunChecksChange}
            testId="commit-run-checks"
          >
            Run checks
          </Checkbox>
        </div>

        <div className="flex flex-col gap-form-gap">
          <span className="text-micro font-bold tracking-wide text-vscode-description">OPTIONS</span>
          <Checkbox
            className="h-row text-section text-vscode-description"
            checked={amend}
            disabled={protectedBranch}
            onChange={onAmendChange}
            testId="commit-amend"
          >
            Amend previous commit
          </Checkbox>
          <Checkbox
            className="h-row text-section text-vscode-description"
            checked={signoff}
            onChange={onSignoffChange}
            testId="commit-signoff"
          >
            Sign-off commit
          </Checkbox>
          <Checkbox
            className="h-row text-section text-vscode-description"
            checked={gpgSign}
            onChange={onGpgSignChange}
            testId="commit-gpg-sign"
          >
            GPG sign
          </Checkbox>
        </div>

        {protectedBranch && (
          <div className="text-section text-nx-red" data-testid="commit-protected-warning">
            Amend is disabled on protected branches.
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-action-gap p-pad-panel pt-2">
        <Button variant="primary" size="content"
          type="button"
          className="h-control-lg min-h-control-lg w-full flex items-center justify-between px-pad-panel rounded-vscode bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
          disabled={!canCommit}
          onClick={onCommit}
          data-testid="commit-button"
        >
          <span className="flex items-center gap-action-gap text-ui-sm font-bold"><GitCommitHorizontal size={14} />Commit {selected.length > 0 ? `${selected.length} files` : ""}</span>
          <span className="text-section text-primary-foreground opacity-75">⌘↵</span>
        </Button>
        <Button variant="ghost" size="content"
          type="button"
          className="h-row-lg min-h-row-lg w-full flex items-center justify-center gap-control-gap rounded-vscode border border-nx-border text-section text-vscode-description hover:bg-vscode-widget-bg disabled:opacity-40"
          disabled={!canCommit}
          onClick={onCommitAndPush}
          data-testid="commit-and-push-button"
        >
          <ArrowUp size={12} />Commit and push
        </Button>
      </div>
    </section>
  );
}
