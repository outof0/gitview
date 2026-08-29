import type {
  ConfirmationSubmission,
  HardResetConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import type { ResetMode } from "@gitview/shared/types/log";
import { TypedDestructiveConfirmDialog } from "./TypedDestructiveConfirmDialog";

type ResetConfirmDialogProps = {
  open: boolean;
  sha: string;
  mode: ResetMode;
  confirmation?: HardResetConfirmationEvidence;
  busy?: boolean;
  onModeChange: (mode: ResetMode) => void;
  onConfirm: (confirmation?: ConfirmationSubmission) => void;
  onCancel: () => void;
};

const MODE_LABELS: Record<ResetMode, string> = {
  soft: "Soft — keep staged and unstaged changes",
  mixed: "Mixed — keep unstaged changes, unstage commits",
  hard: "Hard — discard all local changes",
  keep: "Keep — keep local changes, unstage commits",
};

export function ResetConfirmDialog({
  open,
  sha,
  mode,
  confirmation,
  busy,
  onModeChange,
  onConfirm,
  onCancel,
}: ResetConfirmDialogProps) {
  const destructive = mode === "hard" || mode === "mixed" || mode === "keep";
  const hardResetEvidence = mode === "hard" ? confirmation : undefined;
  const confirmationKey = hardResetEvidence
    ? [
        hardResetEvidence.repoId,
        hardResetEvidence.targetSha,
        hardResetEvidence.repository.headSha,
        hardResetEvidence.repository.currentBranch,
        hardResetEvidence.repository.dirty,
        hardResetEvidence.repository.conflictCount,
        hardResetEvidence.repository.operation,
      ].join(":")
    : mode;

  return (
    <TypedDestructiveConfirmDialog
      open={open}
      title="Reset current branch?"
      description={
        <>
          Reset current branch to commit{" "}
          <span className="font-mono">{sha.slice(0, 7)}</span>. This rewrites
          branch history.
        </>
      }
      expectedTypedValue={hardResetEvidence?.expectedTypedValue}
      confirmationKey={confirmationKey}
      confirmLabel="Reset"
      testId="reset-confirm-dialog"
      cancelTestId="reset-cancel"
      confirmTestId="reset-confirm"
      inputTestId="reset-typed-value"
      busy={busy}
      warning={
        destructive
          ? "This action may discard uncommitted work or staged changes."
          : undefined
      }
      onCancel={onCancel}
      onConfirm={(typedValue) =>
        onConfirm(
          hardResetEvidence
            ? { evidence: hardResetEvidence, typedValue }
            : undefined,
        )
      }
    >
      <label className="block mb-3">
        <span className="block mb-1">Reset mode</span>
        <select
          className="w-full h-8 px-2 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          value={mode}
          onChange={(event) => onModeChange(event.target.value as ResetMode)}
          data-testid="reset-mode-select"
        >
          {(Object.keys(MODE_LABELS) as ResetMode[]).map((key) => (
            <option key={key} value={key}>
              {MODE_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
    </TypedDestructiveConfirmDialog>
  );
}
