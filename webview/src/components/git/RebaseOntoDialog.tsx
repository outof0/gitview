import { useEffect, useState } from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";
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
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="rebase-onto-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
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
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span>Onto</span>
          <BranchRefSelect
            branches={branches}
            value={onto}
            onChange={setOnto}
            exclude={from || undefined}
            testId="rebase-onto-ref"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Branch to rebase</span>
          <BranchRefSelect
            branches={branches}
            value={from}
            onChange={setFrom}
            placeholder={`${currentBranch ?? "Current branch"} (current)`}
            exclude={onto || undefined}
            testId="rebase-from-ref"
          />
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={interactive}
            onChange={(e) => setInteractive(e.target.checked)}
            data-testid="rebase-interactive"
          />
          <span>
            Interactive
            <span className="block opacity-70">
              Edit the commit list before replaying (-i).
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={rebaseMerges}
            onChange={(e) => setRebaseMerges(e.target.checked)}
            data-testid="rebase-merges"
          />
          <span>
            Preserve merge commits
            <span className="block opacity-70">--rebase-merges</span>
          </span>
        </label>
      </div>
    </GitDialogShell>
  );
}
