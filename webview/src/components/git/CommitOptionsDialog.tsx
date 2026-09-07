import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { GitDialogField, GitDialogShell } from "../ui/GitDialogShell";
import { TextField } from "../ui/TextField";

export type CommitOptionsDialogProps = {
  open: boolean;
  author: string;
  signoff: boolean;
  gpgSign: boolean;
  runHooks: boolean;
  runChecks: boolean;
  busy: boolean;
  onAuthorChange: (value: string) => void;
  onSignoffChange: (value: boolean) => void;
  onGpgSignChange: (value: boolean) => void;
  onRunHooksChange: (value: boolean) => void;
  onRunChecksChange: (value: boolean) => void;
  onRunChecksNow?: () => void;
  onClose: () => void;
};

export function CommitOptionsDialog({
  open,
  author,
  signoff,
  gpgSign,
  runHooks,
  runChecks,
  busy,
  onAuthorChange,
  onSignoffChange,
  onGpgSignChange,
  onRunHooksChange,
  onRunChecksChange,
  onRunChecksNow,
  onClose,
}: CommitOptionsDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Git"
      size="wide"
      testId="commit-options-dialog"
      onCancel={onClose}
      footer={
        <Button type="button" variant="primary" size="compact" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-ui-sm">
        <section className="flex flex-col gap-2">
          <h4 className="m-0 border-b border-border pb-1 text-ui font-semibold text-foreground">
            Commit
          </h4>
          <GitDialogField label="Author">
            <TextField
              size="compact"
              value={author}
              placeholder="Name <email@example.com>"
              onChange={(event) => onAuthorChange(event.target.value)}
              disabled={busy}
              data-testid="commit-options-author"
            />
          </GitDialogField>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Checkbox
              checked={signoff}
              disabled={busy}
              onChange={onSignoffChange}
              testId="commit-options-signoff"
            >
              Sign-off commit
            </Checkbox>
            <Checkbox
              checked={gpgSign}
              disabled={busy}
              onChange={onGpgSignChange}
              testId="commit-options-gpg-sign"
            >
              GPG sign
            </Checkbox>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="m-0 border-b border-border pb-1 text-ui font-semibold text-foreground">
            Commit Checks
          </h4>
          <Checkbox
            checked={runHooks}
            disabled={busy}
            onChange={onRunHooksChange}
            testId="commit-options-hooks"
          >
            Run Git hooks
          </Checkbox>
          <div className="flex items-center justify-between gap-2">
            <Checkbox
              checked={runChecks}
              disabled={busy}
              onChange={onRunChecksChange}
              testId="commit-options-checks"
            >
              Run configured commit checks
            </Checkbox>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              disabled={busy || !runChecks || !onRunChecksNow}
              onClick={onRunChecksNow}
              data-testid="commit-options-run-checks"
            >
              Run now
            </Button>
          </div>
          <p className="m-0 text-ui-sm text-vscode-description">
            Enabled checks run before commit. Warnings require confirmation and errors block the commit.
          </p>
        </section>
      </div>
    </GitDialogShell>
  );
}
