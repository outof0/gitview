import type { ReactNode } from "react";
import { CommitCheckWarningDialog } from "../../components/git/CommitCheckWarningDialog";
import { CommitDialog } from "../../components/git/CommitDialog";
import { CreateBranchDialog } from "../../components/git/CreateBranchDialog";
import { CreateBranchFromCommitDialog } from "../../components/git/CreateBranchFromCommitDialog";
import { DeleteBranchDialog } from "../../components/git/DeleteBranchDialog";
import { DeleteReviewSourceBranchDialog } from "../../components/git/DeleteReviewSourceBranchDialog";
import { DropSelectedConfirmDialog } from "../../components/git/DropSelectedConfirmDialog";
import { EditCommitMessageDialog } from "../../components/git/EditCommitMessageDialog";
import { ForceCheckoutDialog } from "../../components/git/ForceCheckoutDialog";
import { MergeBranchDialog } from "../../components/git/MergeBranchDialog";
import { PushUpstreamDialog } from "../../components/git/PushUpstreamDialog";
import { RebaseOntoDialog } from "../../components/git/RebaseOntoDialog";
import { RenameBranchDialog } from "../../components/git/RenameBranchDialog";
import { ResetConfirmDialog } from "../../components/git/ResetConfirmDialog";
import { RewriteHistoryConfirmDialog } from "../../components/git/RewriteHistoryConfirmDialog";
import { RollbackConfirmDialog } from "../../components/git/RollbackConfirmDialog";
import { SyncBranchConfirmDialog } from "../../components/git/SyncBranchConfirmDialog";
import { UpdateAllRootsDialog } from "../../components/git/UpdateAllRootsDialog";
import { WorktreeRemoveDialog } from "../../components/git/WorktreeRemoveDialog";
import type {
  GitWorkspaceDialogId,
  GitWorkspaceDialogPayloads,
} from "../../stores/gitWorkspaceDialogs";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { StashDialog, UnstashDialog } from "./GitWorkspaceStashDialogs";

/**
 * A renderer is only invoked while its dialog is open, so the payload is always
 * present — that is why none of these need the `?? ""` placeholders and re-entry
 * guards that an always-mounted dialog requires.
 */
export type GitWorkspaceDialogRenderer<K extends GitWorkspaceDialogId> = (
  payload: GitWorkspaceDialogPayloads[K],
  ctx: GitWorkspaceController,
) => ReactNode;

export const GIT_WORKSPACE_DIALOG_RENDERERS: {
  [K in GitWorkspaceDialogId]: GitWorkspaceDialogRenderer<K>;
} = {
  stash: (_payload, ctx) => <StashDialog ctx={ctx} />,

  unstash: (payload, ctx) => <UnstashDialog payload={payload} ctx={ctx} />,

  commit: (_payload, ctx) => {
    const runCommit = async (pushAfter: boolean) => {
      ctx.closeDialog("commit");
      await ctx.commit(pushAfter);
    };
    return (
      <CommitDialog
        open
        files={ctx.committableFiles()}
        commitScope={ctx.commitScope}
        onToggleFile={ctx.toggleCommitScope}
        onSetScope={ctx.setCommitScope}
        selectedFilePath={ctx.selectedFilePath}
        onSelectFile={(path) => void ctx.handleSelectFile(path)}
        diffDocument={ctx.diffDocument}
        message={ctx.commitMessage}
        amend={ctx.amend}
        signoff={ctx.signoff}
        gpgSign={ctx.gpgSign}
        author={ctx.author}
        runChecks={ctx.runChecks}
        busy={ctx.syncing}
        currentBranch={ctx.activeRepo?.currentBranch}
        protectedBranch={ctx.activeRepo?.protectedBranch}
        onMessageChange={ctx.setCommitMessage}
        onAmendChange={ctx.setAmend}
        onSignoffChange={ctx.setSignoff}
        onGpgSignChange={ctx.setGpgSign}
        onAuthorChange={ctx.setAuthor}
        onRunChecksChange={ctx.setRunChecks}
        onCommit={() => void runCommit(false)}
        onCommitAndPush={() => void runCommit(true)}
        onCancel={() => ctx.closeDialog("commit")}
      />
    );
  },

  createBranch: (payload, ctx) => (
    <CreateBranchDialog
      open
      branches={ctx.branchSnapshot?.branches ?? []}
      startPoint={payload.startPoint}
      busy={ctx.syncing}
      onCancel={() => ctx.closeDialog("createBranch")}
      onConfirm={(name, startPoint, opts) => {
        const repo = ctx.activeRepo;
        if (!repo) {
          return;
        }
        ctx.closeDialog("createBranch");
        void ctx.runMutation(async () => {
          await ctx.clientRef.current.createBranch(repo.id, name, startPoint, opts);
          await ctx.loadBranches();
        });
      }}
    />
  ),

  merge: (payload, ctx) => (
    <MergeBranchDialog
      open
      branches={ctx.branchSnapshot?.branches ?? []}
      branchRef={payload.ref}
      currentBranch={currentBranchName(ctx)}
      busy={ctx.syncing}
      onCancel={() => ctx.closeDialog("merge")}
      onConfirm={(ref, opts) => {
        const repo = ctx.activeRepo;
        if (!repo) {
          return;
        }
        ctx.closeDialog("merge");
        void ctx.runMutation(async () => {
          await ctx.clientRef.current.mergeBranch(repo.id, ref, opts);
          await ctx.loadBranches();
        });
      }}
    />
  ),

  rebase: (payload, ctx) => (
    <RebaseOntoDialog
      open
      branches={ctx.branchSnapshot?.branches ?? []}
      ontoRef={payload.onto}
      currentBranch={currentBranchName(ctx)}
      busy={ctx.syncing}
      onCancel={() => ctx.closeDialog("rebase")}
      onConfirm={(onto, opts) => {
        const repo = ctx.activeRepo;
        if (!repo) {
          return;
        }
        ctx.closeDialog("rebase");
        void ctx.runMutation(() =>
          ctx.clientRef.current.rebaseOnto(repo.id, onto, opts),
        );
      }}
    />
  ),

  forceCheckout: (payload, ctx) => (
    <ForceCheckoutDialog
      open
      refName={payload.ref}
      onCancel={() => ctx.closeDialog("forceCheckout")}
      onConfirm={() => {
        ctx.closeDialog("forceCheckout");
        void ctx.runMutation(() =>
          ctx.handleBranchCheckout(payload.ref, { ...payload.opts, force: true }),
        );
      }}
    />
  ),

  renameBranch: (payload, ctx) => (
    <RenameBranchDialog
      open
      oldName={payload.oldName}
      onCancel={() => ctx.closeDialog("renameBranch")}
      onConfirm={(newName) => {
        const repo = ctx.activeRepo;
        if (!repo) {
          return;
        }
        ctx.closeDialog("renameBranch");
        void ctx.runMutation(async () => {
          await ctx.clientRef.current.renameBranch(repo.id, payload.oldName, newName);
          await ctx.loadBranches();
        });
      }}
    />
  ),

  deleteBranch: (payload, ctx) => (
    <DeleteBranchDialog
      open
      branchName={payload.name}
      forceRequired={payload.forceRequired}
      onCancel={() => ctx.closeDialog("deleteBranch")}
      onConfirm={(force) => void ctx.handleDeleteBranch(payload.name, force)}
    />
  ),

  deleteReviewSourceBranch: (payload, ctx) => (
    <DeleteReviewSourceBranchDialog
      open
      branchName={payload.branchName}
      onCancel={() => ctx.closeDialog("deleteReviewSourceBranch")}
      onConfirm={() => {
        const repo = ctx.activeRepo;
        const providerId = ctx.reviewSnapshot?.selectedProviderId;
        const reviewId = ctx.selectedReviewId;
        if (!repo || !providerId || !reviewId) {
          return;
        }
        ctx.closeDialog("deleteReviewSourceBranch");
        void ctx.runMutation(() =>
          ctx.clientRef.current.deleteReviewSourceBranch(
            repo.id,
            providerId,
            reviewId,
          ),
        );
      }}
    />
  ),

  rollbackConfirm: (payload, ctx) => (
    <RollbackConfirmDialog
      open
      paths={payload.paths}
      onCancel={() => ctx.closeDialog("rollbackConfirm")}
      onConfirm={() => void ctx.handleRollback(payload.paths, true)}
    />
  ),

  reset: (payload, ctx) => (
    <ResetConfirmDialog
      open
      sha={payload.sha}
      mode={payload.mode}
      onModeChange={(mode) => ctx.openDialog("reset", { ...payload, mode })}
      onCancel={() => ctx.closeDialog("reset")}
      onConfirm={() => void ctx.handleReset(payload.sha, payload.mode, true)}
    />
  ),

  createBranchFromCommit: (payload, ctx) => (
    <CreateBranchFromCommitDialog
      open
      sha={payload.sha}
      onCancel={() => ctx.closeDialog("createBranchFromCommit")}
      onConfirm={(name) => {
        const repo = ctx.activeRepo;
        if (!repo) {
          return;
        }
        ctx.closeDialog("createBranchFromCommit");
        void ctx.runMutation(async () => {
          await ctx.clientRef.current.createBranchFromCommit(
            repo.id,
            name,
            payload.sha,
          );
          await ctx.loadBranches();
        });
      }}
    />
  ),

  editMessage: (payload, ctx) => (
    <EditCommitMessageDialog
      open
      sha={payload.sha}
      initialMessage={payload.subject}
      onCancel={() => ctx.closeDialog("editMessage")}
      onConfirm={(message) => {
        const repo = ctx.activeRepo;
        if (!repo) {
          return;
        }
        ctx.closeDialog("editMessage");
        void ctx.runMutation(async () => {
          await ctx.clientRef.current.editCommitMessage(
            repo.id,
            payload.sha,
            message,
            true,
          );
          await ctx.loadLog();
        });
      }}
    />
  ),

  rewrite: (payload, ctx) => (
    <RewriteHistoryConfirmDialog
      open
      sha={payload.sha}
      action={payload.action}
      onCancel={() => ctx.closeDialog("rewrite")}
      onConfirm={() =>
        void ctx.handleRewriteHistory(payload.sha, payload.action, true)
      }
    />
  ),

  commitCheckWarnings: (payload, ctx) => (
    <CommitCheckWarningDialog
      open
      issues={payload.issues}
      onCancel={() => {
        ctx.closeDialog("commitCheckWarnings");
        ctx.setCommitAfterChecksConfirmed(false);
      }}
      onConfirm={() => {
        ctx.closeDialog("commitCheckWarnings");
        ctx.setCommitAfterChecksConfirmed(true);
        void ctx.commit(false, true);
      }}
    />
  ),

  dropSelected: (payload, ctx) => (
    <DropSelectedConfirmDialog
      open
      sha={payload.sha}
      path={payload.path}
      onCancel={() => ctx.closeDialog("dropSelected")}
      onConfirm={() =>
        void ctx.handleDropSelected(
          payload.sha,
          payload.path,
          { hunkIndexes: payload.hunkIndexes, lines: payload.lines },
          true,
        )
      }
    />
  ),

  pushUpstream: (payload, ctx) => (
    <PushUpstreamDialog
      open
      branchName={payload.branch}
      remote={payload.remote}
      onCancel={() => ctx.closeDialog("pushUpstream")}
      onConfirm={() => void ctx.confirmPushUpstream()}
    />
  ),

  syncBranch: (payload, ctx) => (
    <SyncBranchConfirmDialog
      open
      refName={payload.ref}
      targets={payload.targets}
      onCancel={() => ctx.closeDialog("syncBranch")}
      onConfirm={() => {
        ctx.closeDialog("syncBranch");
        void ctx.runMutation(() =>
          ctx.handleBranchCheckout(payload.ref, payload.opts, true),
        );
      }}
    />
  ),

  updateAllRootsReport: (payload, ctx) => (
    <UpdateAllRootsDialog
      open
      results={payload.results}
      onClose={() => ctx.closeDialog("updateAllRootsReport")}
    />
  ),

  worktreeRemove: (payload, ctx) => (
    <WorktreeRemoveDialog
      open
      path={payload.path}
      forceRequired={payload.forceRequired}
      onCancel={() => ctx.closeDialog("worktreeRemove")}
      onConfirm={(force) => void ctx.handleRemoveWorktree(payload.path, force, true)}
    />
  ),
};

function currentBranchName(ctx: GitWorkspaceController): string | null {
  return ctx.branchSnapshot?.branches.find((branch) => branch.current)?.name ?? null;
}
