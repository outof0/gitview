import { useEffect, useState } from "react";
import { validateBranchName } from "@gitview/shared/lib/branchName";
import type { BranchEntry } from "@gitview/shared/types/branch";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";
import { BranchRefSelect } from "./BranchRefSelect";

type CreateBranchDialogProps = {
  open: boolean;
  branches: BranchEntry[];
  /** Ref the branch starts from; empty means the current HEAD. */
  startPoint?: string;
  busy?: boolean;
  onConfirm: (
    name: string,
    startPoint: string | undefined,
    opts: { checkout?: boolean; force?: boolean },
  ) => void;
  onCancel: () => void;
};

export function CreateBranchDialog({
  open,
  branches,
  startPoint = "",
  busy = false,
  onConfirm,
  onCancel,
}: CreateBranchDialogProps) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(startPoint);
  const [checkout, setCheckout] = useState(true);
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setFrom(startPoint);
      setCheckout(true);
      setForce(false);
    }
  }, [open, startPoint]);

  if (!open) {
    return null;
  }

  const trimmed = name.trim();
  const nameError = trimmed ? validateBranchName(trimmed) : undefined;
  const exists = branches.some((b) => !b.remote && b.name === trimmed);
  const blocked = !trimmed || Boolean(nameError) || (exists && !force);

  const confirm = () => {
    if (blocked) {
      return;
    }
    onConfirm(trimmed, from || undefined, {
      checkout,
      force: force || undefined,
    });
  };

  return (
    <GitDialogShell
      open={open}
      title="Create New Branch"
      testId="create-branch-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="create-branch-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            disabled={busy || blocked}
            onClick={confirm}
            data-testid="create-branch-confirm"
          >
            Create
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span>New branch name</span>
          <input
            type="text"
            autoFocus
            className="w-full h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            data-testid="create-branch-name"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Create from</span>
          <BranchRefSelect
            branches={branches}
            value={from}
            onChange={setFrom}
            placeholder="HEAD (current branch)"
            testId="create-branch-start-point"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={checkout}
            onChange={(e) => setCheckout(e.target.checked)}
            data-testid="create-branch-checkout"
          />
          <span>Checkout branch</span>
        </label>

        {exists ? (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              data-testid="create-branch-force"
            />
            <span>
              Overwrite existing branch
              <span className="block opacity-70">
                Resets{" "}
                <span className="font-mono">{trimmed}</span> to the start point.
                Commits only on that branch are lost.
              </span>
            </span>
          </label>
        ) : null}

        {nameError ? (
          <p
            className="m-0 text-[var(--vscode-inputValidation-errorForeground,var(--vscode-errorForeground))]"
            data-testid="create-branch-error"
          >
            {nameError}
          </p>
        ) : null}
      </div>
    </GitDialogShell>
  );
}
