import type { SyncBranchTarget } from "@gitview/shared/types/branch";
import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { ScrollArea } from "../ui/ScrollArea";

type SyncBranchConfirmDialogProps = {
  open: boolean;
  refName: string;
  targets: SyncBranchTarget[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function SyncBranchConfirmDialog({
  open,
  refName,
  targets,
  onConfirm,
  onCancel,
}: SyncBranchConfirmDialogProps) {
  const applicable = targets.filter((target) => target.available);
  const unavailable = targets.filter((target) => !target.available);

  return (
    <GitDialogShell
      open={open}
      title="Checkout branch across repositories?"
      size="wide"
      onCancel={onCancel}
      testId="sync-branch-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="sync-branch-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            onClick={onConfirm}
            disabled={applicable.length === 0}
            data-testid="sync-branch-confirm"
          >
            Checkout {applicable.length} repositor
            {applicable.length === 1 ? "y" : "ies"}
          </Button>
        </>
      }
    >
      <p className="mt-0 mb-3">
        Synchronous branch control will checkout{" "}
        <span className="font-mono">{refName}</span> in matching workspace
        repositories.
      </p>
      <ScrollArea axis="vertical" className="max-h-sync-targets-max">
        <ul className="text-ui text-foreground space-y-2 mb-0">
          {applicable.map((target) => (
            <li
              key={target.repoId}
              className="rounded-vscode border border-border px-2 py-1.5"
              data-testid={`sync-branch-target-${target.repoId}`}
            >
              <div className="font-medium">{target.name}</div>
              <div className="text-vscode-description">
                {target.currentBranch
                  ? `Current: ${target.currentBranch}`
                  : "Detached or unknown branch"}
              </div>
            </li>
          ))}
          {unavailable.map((target) => (
            <li
              key={target.repoId}
              className="rounded-vscode border border-border px-2 py-1.5 opacity-70"
              data-testid={`sync-branch-skipped-${target.repoId}`}
            >
              <div className="font-medium">{target.name}</div>
              <div className="text-vscode-description">
                {target.unavailableReason ?? "Branch unavailable"}
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </GitDialogShell>
  );
}
