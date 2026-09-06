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
import { BranchRefSelect } from "./BranchRefSelect";

export type RebaseChoice = {
  interactive?: boolean;
  from?: string;
  rebaseMerges?: boolean;
};

type RebaseOntoDialogProps = {
  open: boolean;
  branches: BranchEntry[];
  /** Preselected target; empty lets the user pick one here. */
  ontoRef?: string;
  currentBranch?: string | null;
  busy?: boolean;
  onConfirm: (onto: string, opts: RebaseChoice) => void;
  onCancel: () => void;
};

export function RebaseOntoDialog({
  open,
  branches,
  ontoRef = "",
  currentBranch,
  busy = false,
  onConfirm,
  onCancel,
}: RebaseOntoDialogProps) {
  const [onto, setOnto] = useState(ontoRef);
  const [from, setFrom] = useState("");
  const [interactive, setInteractive] = useState(false);
  const [rebaseMerges, setRebaseMerges] = useState(false);

  useEffect(() => {
    if (open) {
      setOnto(ontoRef);
      setFrom("");
      setInteractive(false);
      setRebaseMerges(false);
    }
  }, [open, ontoRef]);

  if (!open) {
    return null;
  }

  return (
    <GitDialogShell
      open={open}
      title="Rebase Branch"
      testId="rebase-onto-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="rebase-onto-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={busy || !onto}
            onClick={() =>
              onConfirm(onto, {
                interactive: interactive || undefined,
                from: from || undefined,
                rebaseMerges: rebaseMerges || undefined,
              })
            }
            data-testid="rebase-onto-confirm"
          >
            Rebase
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <GitDialogField label="Onto">
          <BranchRefSelect
            branches={branches}
            value={onto}
            onChange={setOnto}
            exclude={from || undefined}
            testId="rebase-onto-ref"
          />
        </GitDialogField>

        <GitDialogField label="Branch to rebase">
          <BranchRefSelect
            branches={branches}
            value={from}
            onChange={setFrom}
            placeholder={`${currentBranch ?? "Current branch"} (current)`}
            exclude={onto || undefined}
            testId="rebase-from-ref"
          />
        </GitDialogField>

        <Checkbox
          checked={interactive}
          onChange={setInteractive}
          testId="rebase-interactive"
          hint="Edit the commit list before replaying (-i)."
        >
          Interactive
        </Checkbox>

        <Checkbox
          checked={rebaseMerges}
          onChange={setRebaseMerges}
          testId="rebase-merges"
          hint="--rebase-merges"
        >
          Preserve merge commits
        </Checkbox>
      </div>
    </GitDialogShell>
  );
}
