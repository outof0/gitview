import { Fragment, useEffect } from "react";
import type {
  GitWorkspaceDialogId,
  GitWorkspaceDialogPayloads,
} from "../../stores/gitWorkspaceDialogs";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { GIT_WORKSPACE_DIALOG_RENDERERS } from "./gitWorkspaceDialogRegistry";
import { GitWorkspacePopups } from "./GitWorkspacePopups";

/** Branch pickers render empty unless the list was fetched at least once. */
const NEEDS_BRANCH_LIST: readonly GitWorkspaceDialogId[] = [
  "createBranch",
  "merge",
  "rebase",
];

function DialogSlot<K extends GitWorkspaceDialogId>({
  id,
  payload,
  ctx,
}: {
  id: K;
  payload: GitWorkspaceDialogPayloads[K];
  ctx: GitWorkspaceController;
}) {
  return <>{GIT_WORKSPACE_DIALOG_RENDERERS[id](payload, ctx)}</>;
}

export function GitWorkspaceDialogs({ ctx }: { ctx: GitWorkspaceController }) {
  const { dialogs, loadBranches } = ctx;
  // Also covers the popup: the native menu can open it before the repo snapshot
  // has landed, and `loadBranches` is a no-op until there is an active repo.
  const needsBranches =
    ctx.branchesOpen ||
    NEEDS_BRANCH_LIST.some((id) => dialogs[id] !== undefined);
  const branchCount = ctx.branchSnapshot?.branches.length ?? 0;
  useEffect(() => {
    if (needsBranches && branchCount === 0) {
      void loadBranches();
    }
  }, [needsBranches, branchCount, loadBranches]);

  return (
    <>
      <GitWorkspacePopups ctx={ctx} />
      {Object.keys(dialogs).map((key) => {
        // Object.keys widens to string, and TypeScript cannot relate the key
        // back to its own payload across the union; the map type guarantees it.
        const id = key as GitWorkspaceDialogId;
        const payload = dialogs[id];
        return payload === undefined ? null : (
          <Fragment key={id}>
            <DialogSlot
              id={id}
              payload={payload as GitWorkspaceDialogPayloads[typeof id]}
              ctx={ctx}
            />
          </Fragment>
        );
      })}
    </>
  );
}
