import {
  useEffect,
  useState,
} from "react";
import { validateBranchName } from "@gitview/shared/lib/branchName";
import type { BranchEntry } from "@gitview/shared/types/branch";
import {
  GitDialogField,
  GitDialogShell,
  gitDialogError,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { TextField } from "../ui/TextField";
import { BranchRefSelect } from "./BranchRefSelect";

type CreateBranchDialogProps = {
  open: boolean;
  branches: BranchEntry[];
  /** Ref the branch starts from; empty means the current HEAD. */
  startPoint?: string;
  busy?: boolean;
  /** Editor-area webview: skip the dim overlay so the tab is not a nested modal. */
  embedded?: boolean;
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
  embedded = false,
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
      variant={embedded ? "embedded" : "modal"}
      onCancel={onCancel}
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="create-branch-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={busy || blocked}
            onClick={confirm}
            data-testid="create-branch-confirm"
          >
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <GitDialogField label="New branch name">
          <TextField
            size="compact"
            containerClassName="w-full"
            autoFocus
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
        </GitDialogField>

        <GitDialogField label="Create from">
          <BranchRefSelect
            branches={branches}
            value={from}
            onChange={setFrom}
            placeholder="HEAD (current branch)"
            testId="create-branch-start-point"
          />
        </GitDialogField>

        <Checkbox
          checked={checkout}
          onChange={setCheckout}
          testId="create-branch-checkout"
        >
          Checkout branch
        </Checkbox>

        {exists ? (
          <Checkbox
            testId="create-branch-force"
            checked={force}
            onChange={setForce}
            hint={
              <>
                Resets <span className="font-mono text-foreground">{trimmed}</span> to
                the start point. Commits only on that branch are lost.
              </>
            }
          >
            Overwrite existing branch
          </Checkbox>
        ) : null}

        {nameError ? (
          <p className={gitDialogError} data-testid="create-branch-error">
            {nameError}
          </p>
        ) : null}
      </div>
    </GitDialogShell>
  );
}
