import { Button } from "../ui/Button";
import { GitMerge, SkipForward, X } from "lucide-react";
import type { OperationState } from "@gitview/shared/types/operation";
import {
  operationCanContinue,
  operationCanSkip,
} from "@gitview/shared/types/operation";
import { operationLabel } from "../../lib/operationLabel";

type OperationRecoveryBarProps = {
  operation: OperationState;
  busy?: boolean;
  onContinue?: () => void;
  onSkip?: () => void;
  onAbort?: () => void;
};

export function OperationRecoveryBar({
  operation,
  busy = false,
  onContinue,
  onSkip,
  onAbort,
}: OperationRecoveryBarProps) {
  if (operation.type === "none") {
    return null;
  }

  const label = operationLabel(operation);
  const showSkip = operationCanSkip(operation) && operation.type !== "revert";

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-editor-info-border bg-editor-info-bg text-editor-info-fg"
      data-testid="operation-recovery-bar"
      data-operation-type={operation.type}
    >
      <span className="text-ui-sm flex-1">{label}</span>
      {operationCanContinue(operation) && onContinue && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-ui-sm rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onContinue}
          aria-label="Continue Git operation"
          data-testid="operation-continue"
        >
          <GitMerge size={14} aria-hidden />
          Continue
        </Button>
      )}
      {showSkip && onSkip && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-ui-sm rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onSkip}
          aria-label="Skip current Git operation step"
          data-testid="operation-skip"
        >
          <SkipForward size={14} aria-hidden />
          Skip
        </Button>
      )}
      {operation.canAbort && onAbort && (
        <Button variant="ghost" size="content"
          type="button"
          className="h-7 px-2 flex items-center gap-1 text-ui-sm rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
          disabled={busy}
          onClick={onAbort}
          aria-label="Abort Git operation"
          data-testid="operation-abort"
        >
          <X size={14} aria-hidden />
          Abort
        </Button>
      )}
    </div>
  );
}