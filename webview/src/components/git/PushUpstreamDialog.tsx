import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";

type PushUpstreamDialogProps = {
  open: boolean;
  branchName: string;
  remote: string;
  busy?: boolean;
  cancelling?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onCancelPush?: () => void;
};

export function PushUpstreamDialog({
  open,
  branchName,
  remote,
  busy = false,
  cancelling = false,
  onConfirm,
  onCancel,
  onCancelPush,
}: PushUpstreamDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Set upstream and push?"
      size="medium"
      onCancel={busy ? onCancelPush : onCancel}
      testId="push-upstream-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={busy ? onCancelPush : onCancel}
            disabled={busy && (!onCancelPush || cancelling)}
            data-testid="push-upstream-cancel"
          >
            {cancelling ? "Cancelling…" : busy ? "Cancel push" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            onClick={onConfirm}
            disabled={busy}
            data-testid="push-upstream-confirm"
          >
            {busy ? "Pushing…" : "Push and set upstream"}
          </Button>
        </>
      }
    >
      <p className="m-0">
        Branch <span className="font-mono">{branchName}</span> has no upstream
        tracking branch. Push to{" "}
        <span className="font-mono">
          {remote}/{branchName}
        </span>{" "}
        and set it as upstream?
      </p>
    </GitDialogShell>
  );
}
