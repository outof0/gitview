import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { GitFileStatus } from "@gitview/shared/types/status";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";
import { ResizableSplit } from "../ui/ResizableSplit";
import { WorkspaceDiffPanel } from "./WorkspaceDiffPanel";
import { cn } from "../../lib/cn";

const STATUS_CHAR: Record<GitFileStatus["kind"], string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  unversioned: "?",
  ignored: "!",
  conflicted: "U",
};

export type CommitDialogProps = {
  open: boolean;
  files: GitFileStatus[];
  commitScope: Set<string>;
  onToggleFile: (path: string) => void;
  onSetScope: (paths: string[]) => void;
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  diffDocument: WorkspaceDiffDocument | null;
  message: string;
  amend: boolean;
  signoff: boolean;
  gpgSign: boolean;
  author: string;
  runChecks: boolean;
  busy: boolean;
  currentBranch?: string | null;
  protectedBranch?: boolean;
  onMessageChange: (value: string) => void;
  onAmendChange: (value: boolean) => void;
  onSignoffChange: (value: boolean) => void;
  onGpgSignChange: (value: boolean) => void;
  onAuthorChange: (value: string) => void;
  onRunChecksChange: (value: boolean) => void;
  onCommit: () => void;
  onCommitAndPush: () => void;
  onCancel: () => void;
};

/** Pick files, preview each diff, then commit with the usual Git options. */
export function CommitDialog({
  open,
  files,
  commitScope,
  onToggleFile,
  onSetScope,
  selectedFilePath,
  onSelectFile,
  diffDocument,
  message,
  amend,
  signoff,
  gpgSign,
  author,
  runChecks,
  busy,
  currentBranch,
  protectedBranch = false,
  onMessageChange,
  onAmendChange,
  onSignoffChange,
  onGpgSignChange,
  onAuthorChange,
  onRunChecksChange,
  onCommit,
  onCommitAndPush,
  onCancel,
}: CommitDialogProps) {
  if (!open) {
    return null;
  }

  const selectedCount = files.filter((file) => commitScope.has(file.path)).length;
  const allChecked = files.length > 0 && selectedCount === files.length;
  const canCommit = message.trim().length > 0 && selectedCount > 0 && !busy;

  const fileList = (
    <div className="h-full min-h-0 flex flex-col" data-testid="commit-dialog-files">
      <div className="shrink-0 h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] px-[var(--nx-pad-x)] flex items-center gap-1.5 text-[length:var(--nx-font-size-section)] font-semibold uppercase tracking-wide text-vscode-description border-b border-border">
        <input
          type="checkbox"
          checked={allChecked}
          disabled={files.length === 0}
          onChange={() =>
            onSetScope(allChecked ? [] : files.map((file) => file.path))
          }
          aria-label="Select all changes"
          data-testid="commit-dialog-select-all"
        />
        {selectedCount} of {files.length}
      </div>
      {files.length === 0 ? (
        <div className="px-1.5 py-2 text-vscode-description" data-testid="commit-dialog-empty">
          No changes to commit.
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto m-0 p-0 list-none">
          {files.map((file) => {
            const active = selectedFilePath === file.path;
            return (
              <li key={file.path} className="list-none">
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-1.5 min-h-[var(--nx-row-h)]",
                    "text-[length:var(--nx-font-size-ui)]",
                    active
                      ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                      : "hover:bg-list-hover",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={commitScope.has(file.path)}
                    onChange={() => onToggleFile(file.path)}
                    aria-label={file.path}
                    data-testid={`commit-dialog-check-${file.path}`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left border-0 bg-transparent cursor-pointer text-inherit"
                    data-testid={`commit-dialog-file-${file.path}`}
                  >
                    <span className="shrink-0 w-3 font-mono opacity-80">
                      {STATUS_CHAR[file.kind]}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{file.path}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const diffPane = (
    <div className="h-full min-h-0 flex flex-col" data-testid="commit-dialog-diff">
      {selectedFilePath === null ? (
        <div className="px-1.5 py-2 text-vscode-description">
          Select a file to see its changes.
        </div>
      ) : (
        <WorkspaceDiffPanel
          document={diffDocument}
          filePath={selectedFilePath}
          borderless
        />
      )}
    </div>
  );

  return (
    <GitDialogShell
      title={currentBranch ? `Commit Changes to ${currentBranch}` : "Commit Changes"}
      size="xl"
      testId="commit-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="commit-dialog-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            disabled={!canCommit}
            onClick={onCommitAndPush}
            data-testid="commit-dialog-commit-and-push"
          >
            Commit and Push
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            disabled={!canCommit}
            onClick={onCommit}
            data-testid="commit-dialog-commit"
          >
            Commit
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-1.5">
        <ResizableSplit
          direction="horizontal"
          initialPercent={34}
          minFirstPercent={20}
          minSecondPercent={30}
          storageKey="nx.commit.dialog.split"
          className="flex-1 min-h-0 border border-border rounded-vscode overflow-hidden"
          first={fileList}
          second={diffPane}
        />

        <textarea
          className="shrink-0 min-h-[64px] resize-y rounded-vscode border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] px-2 py-1 text-[length:var(--nx-font-size-ui)] font-sans"
          placeholder="Commit message"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          data-testid="commit-dialog-message"
        />

        <input
          type="text"
          className="shrink-0 h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] px-2 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]"
          placeholder="Author override (Name <email@example.com>)"
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          data-testid="commit-dialog-author"
        />

        {protectedBranch && (
          <div
            className="shrink-0 text-[var(--vscode-inputValidation-warningForeground)]"
            data-testid="commit-dialog-protected-warning"
          >
            Amend is disabled on protected branches.
          </div>
        )}

        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <label
            className={cn(
              "flex items-center gap-1.5",
              protectedBranch ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            )}
          >
            <input
              type="checkbox"
              checked={amend}
              disabled={protectedBranch}
              onChange={(e) => onAmendChange(e.target.checked)}
              data-testid="commit-dialog-amend"
            />
            Amend
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={signoff}
              onChange={(e) => onSignoffChange(e.target.checked)}
              data-testid="commit-dialog-signoff"
            />
            Sign-off
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={gpgSign}
              onChange={(e) => onGpgSignChange(e.target.checked)}
              data-testid="commit-dialog-gpg-sign"
            />
            GPG sign
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={runChecks}
              onChange={(e) => onRunChecksChange(e.target.checked)}
              data-testid="commit-dialog-run-checks"
            />
            Run checks
          </label>
        </div>
      </div>
    </GitDialogShell>
  );
}
