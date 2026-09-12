import {
  useState,
} from "react";
import {
  GitDialogField,
  GitDialogShell,
} from "../../ui/GitDialogShell";
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { TextField } from "../../ui/TextField";

type StashChangesDialogProps = {
  open: boolean;
  currentBranch?: string | null;
  /** Paths currently selected in the Changes panel, if any. */
  selectedPaths?: string[];
  busy?: boolean;
  onConfirm: (opts: {
    message?: string;
    includeUntracked?: boolean;
    keepIndex?: boolean;
    paths?: string[];
  }) => void;
  onCancel: () => void;
};

export function StashChangesDialog({
  open,
  currentBranch,
  selectedPaths = [],
  busy = false,
  onConfirm,
  onCancel,
}: StashChangesDialogProps) {
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);

  if (!open) {
    return null;
  }

  const hasSelection = selectedPaths.length > 0;
  const placeholder = currentBranch ? `WIP on ${currentBranch}` : "WIP";

  const confirm = () => {
    onConfirm({
      message: message.trim() || undefined,
      includeUntracked: includeUntracked || undefined,
      keepIndex: keepIndex || undefined,
      paths: onlySelected && hasSelection ? selectedPaths : undefined,
    });
  };

  return (
    <GitDialogShell
      open={open}
      title="Stash Changes"
      testId="stash-changes-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="stash-changes-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={busy}
            onClick={confirm}
            data-testid="stash-changes-confirm"
          >
            Create Stash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <GitDialogField label="Message">
          <TextField
            size="compact"
            containerClassName="w-full"
            placeholder={placeholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            data-testid="stash-changes-message"
          />
        </GitDialogField>

        <Checkbox
          checked={keepIndex}
          onChange={setKeepIndex}
          testId="stash-changes-keep-index"
          hint="Staged changes stay staged. They are still removed from the working tree."
        >
          Keep index
        </Checkbox>

        <Checkbox
          checked={includeUntracked}
          onChange={setIncludeUntracked}
          testId="stash-changes-include-untracked"
          hint="Also stashes files Git is not yet tracking."
        >
          Include untracked files
        </Checkbox>

        {hasSelection ? (
          <Checkbox
            checked={onlySelected}
            onChange={setOnlySelected}
            testId="stash-changes-only-selected"
          >
            Only selected files ({selectedPaths.length})
          </Checkbox>
        ) : null}
      </div>
    </GitDialogShell>
  );
}
