import { TextArea } from "../ui/TextArea";
import { useEffect, useState } from "react";
import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";

type EditCommitMessageDialogProps = {
  open: boolean;
  sha: string;
  initialMessage?: string;
  onConfirm: (message: string) => void;
  onCancel: () => void;
};

export function EditCommitMessageDialog({
  open,
  sha,
  initialMessage = "",
  onConfirm,
  onCancel,
}: EditCommitMessageDialogProps) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (open) {
      setMessage(initialMessage);
    }
  }, [open, initialMessage]);

  return (
    <GitDialogShell
      open={open}
      title="Edit commit message"
      size="wide"
      onCancel={onCancel}
      testId="edit-commit-message-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="edit-commit-message-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={!message.trim()}
            onClick={() => onConfirm(message.trim())}
            data-testid="edit-commit-message-confirm"
          >
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 mt-0">
        Commit <span className="font-mono">{sha.slice(0, 7)}</span>
      </p>
      <TextArea
        className="w-full min-h-edit-message px-2 py-1.5 text-ui text-foreground rounded-vscode border border-border bg-input resize-y"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        data-testid="edit-commit-message-input"
      />
    </GitDialogShell>
  );
}
