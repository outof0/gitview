import {
  useEffect,
  useState,
} from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import {
  GitDialogField,
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { TextField } from "../ui/TextField";
import { BranchRefSelect } from "./BranchRefSelect";

export type MergeBranchChoice = {
  noFf?: boolean;
  squash?: boolean;
  message?: string;
  noCommit?: boolean;
  log?: boolean;
};

type MergeBranchDialogProps = {
  open: boolean;
  branches: BranchEntry[];
  /** Preselected source branch; empty lets the user pick one here. */
  branchRef?: string;
  currentBranch?: string | null;
  busy?: boolean;
  onConfirm: (ref: string, opts: MergeBranchChoice) => void;
  onCancel: () => void;
};

export function MergeBranchDialog({
  open,
  branches,
  branchRef = "",
  currentBranch,
  busy = false,
  onConfirm,
  onCancel,
}: MergeBranchDialogProps) {
  const [ref, setRef] = useState(branchRef);
  const [noFf, setNoFf] = useState(false);
  const [squash, setSquash] = useState(false);
  const [noCommit, setNoCommit] = useState(false);
  const [log, setLog] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setRef(branchRef);
      setNoFf(false);
      setSquash(false);
      setNoCommit(false);
      setLog(false);
      setMessage("");
    }
  }, [open, branchRef]);

  if (!open) {
    return null;
  }

  // --squash and --no-commit both leave the commit to the user, so git rejects -m.
  const messageDisabled = squash || noCommit;

  return (
    <GitDialogShell
      open={open}
      title="Merge into Current Branch"
      testId="merge-branch-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="merge-branch-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={busy || !ref}
            onClick={() =>
              onConfirm(ref, {
                noFf: noFf || undefined,
                squash: squash || undefined,
                noCommit: noCommit || undefined,
                log: log || undefined,
                message:
                  !messageDisabled && message.trim() ? message.trim() : undefined,
              })
            }
            data-testid="merge-branch-confirm"
          >
            Merge
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <GitDialogField
          label={
            <>
              Merge into{" "}
              <span className="font-mono">
                {currentBranch ?? "current branch"}
              </span>{" "}
              from
            </>
          }
        >
          <BranchRefSelect
            branches={branches}
            value={ref}
            onChange={setRef}
            exclude={currentBranch ?? undefined}
            testId="merge-branch-ref"
          />
        </GitDialogField>

        <Checkbox
          checked={noFf}
          disabled={squash}
          onChange={setNoFf}
          testId="merge-no-ff"
          hint="--no-ff"
        >
          Create merge commit even if fast-forward is possible
        </Checkbox>

        <Checkbox
          checked={squash}
          disabled={noFf}
          onChange={setSquash}
          testId="merge-squash"
          hint="--squash"
        >
          Squash commits into a single set of changes
        </Checkbox>

        <Checkbox
          checked={noCommit}
          onChange={setNoCommit}
          testId="merge-no-commit"
          hint="--no-commit"
        >
          Do not commit the merge
        </Checkbox>

        <Checkbox
          checked={log}
          onChange={setLog}
          testId="merge-log"
          hint="--log"
        >
          Add descriptions of merged commits to the message
        </Checkbox>

        <GitDialogField label="Commit message">
          <TextField
            size="compact"
            containerClassName="w-full"
            placeholder={
              messageDisabled
                ? "Commit it yourself after the merge"
                : "Default merge message"
            }
            value={messageDisabled ? "" : message}
            disabled={messageDisabled}
            onChange={(e) => setMessage(e.target.value)}
            data-testid="merge-message"
          />
        </GitDialogField>
      </div>
    </GitDialogShell>
  );
}
