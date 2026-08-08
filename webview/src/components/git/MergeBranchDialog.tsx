import { useEffect, useState } from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";
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
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="merge-branch-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
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
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span>
            Merge into{" "}
            <span className="font-mono text-foreground">
              {currentBranch ?? "current branch"}
            </span>{" "}
            from
          </span>
          <BranchRefSelect
            branches={branches}
            value={ref}
            onChange={setRef}
            exclude={currentBranch ?? undefined}
            testId="merge-branch-ref"
          />
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={noFf}
            disabled={squash}
            onChange={(e) => setNoFf(e.target.checked)}
            data-testid="merge-no-ff"
          />
          <span>
            Create merge commit even if fast-forward is possible
            <span className="block opacity-70">--no-ff</span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={squash}
            disabled={noFf}
            onChange={(e) => setSquash(e.target.checked)}
            data-testid="merge-squash"
          />
          <span>
            Squash commits into a single set of changes
            <span className="block opacity-70">--squash</span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={noCommit}
            onChange={(e) => setNoCommit(e.target.checked)}
            data-testid="merge-no-commit"
          />
          <span>
            Do not commit the merge
            <span className="block opacity-70">--no-commit</span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={log}
            onChange={(e) => setLog(e.target.checked)}
            data-testid="merge-log"
          />
          <span>
            Add descriptions of merged commits to the message
            <span className="block opacity-70">--log</span>
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span>Commit message</span>
          <input
            type="text"
            className="w-full h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground disabled:opacity-40"
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
        </label>
      </div>
    </GitDialogShell>
  );
}
