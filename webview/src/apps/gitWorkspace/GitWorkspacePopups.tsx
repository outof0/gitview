import { BranchesPopup } from "../../components/git/BranchesPopup";
import { TagsPopup } from "../../components/git/TagsPopup";
import { WorktreesPopup } from "../../components/git/WorktreesPopup";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";

/**
 * List panels rather than dialogs: they carry their own snapshot + loading
 * state instead of a payload, so they stay outside the dialog registry.
 */
export function GitWorkspacePopups({ ctx }: { ctx: GitWorkspaceController }) {
  return (
    <>
      <BranchesPopup
        open={ctx.branchesOpen}
        snapshot={ctx.branchSnapshot}
        loading={ctx.branchesLoading}
        busy={ctx.syncing}
        onClose={() => ctx.setBranchesOpen(false)}
        onRefresh={() => void ctx.loadBranches()}
        onRequestForceCheckout={(ref, opts) =>
          ctx.openDialog("forceCheckout", { ref, opts })
        }
        onCheckout={(ref, opts) =>
          ctx.activeRepo &&
          void ctx.runMutation(() => ctx.handleBranchCheckout(ref, opts))
        }
        onCreate={(name) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(async () => {
            await ctx.clientRef.current.createBranch(repo.id, name);
            await ctx.loadBranches();
          });
        }}
        onRename={(branch) =>
          ctx.openDialog("renameBranch", { oldName: branch.name })
        }
        onDelete={(branch) => ctx.openDialog("deleteBranch", { name: branch.name })}
        onPush={(branch) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() =>
            ctx.clientRef.current.pushBranch(repo.id, branch.name, {
              setUpstream: true,
            }),
          );
        }}
        onFavorite={(branch) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() =>
            ctx.clientRef.current.favoriteBranch(repo.id, branch.name),
          );
        }}
        onShowInLog={ctx.handleShowBranchInLog}
        onCompareWithCurrent={ctx.handleCompareWithCurrent}
        onCompareWithWorkingTree={ctx.handleCompareWithWorkingTree}
        onMergeIntoCurrent={(branch) =>
          ctx.openDialog("merge", {
            ref: branch.remote ? branch.fullName : branch.name,
          })
        }
        onRebaseOnto={(branch) =>
          ctx.openDialog("rebase", {
            onto: branch.remote ? branch.fullName : branch.name,
          })
        }
      />

      <TagsPopup
        open={ctx.tagsOpen}
        snapshot={ctx.tagSnapshot}
        loading={ctx.tagsLoading}
        busy={ctx.syncing}
        onClose={() => ctx.setTagsOpen(false)}
        onRefresh={() => void ctx.loadTags()}
        onCreate={(name, message) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() =>
            ctx.clientRef.current.createAnnotatedTag(repo.id, name, message),
          );
        }}
        onCheckout={(name) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() => ctx.clientRef.current.checkoutTag(repo.id, name));
        }}
        onPush={(name) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() => ctx.clientRef.current.pushTag(repo.id, name));
        }}
        onDelete={(name) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() => ctx.clientRef.current.deleteTag(repo.id, name));
        }}
      />

      <WorktreesPopup
        open={ctx.worktreesOpen}
        snapshot={ctx.worktreeSnapshot}
        loading={ctx.worktreesLoading}
        busy={ctx.syncing}
        onClose={() => ctx.setWorktreesOpen(false)}
        onRefresh={() => void ctx.loadWorktrees()}
        onAdd={(path, opts) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() =>
            ctx.clientRef.current.addWorktree(repo.id, path, opts),
          );
        }}
        onOpen={(path) => {
          const repo = ctx.activeRepo;
          if (!repo) {
            return;
          }
          void ctx.runMutation(() =>
            ctx.clientRef.current.openWorktree(repo.id, path),
          );
        }}
        onRemove={(path) => void ctx.handleRemoveWorktree(path)}
      />
    </>
  );
}
