import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { CommitPanel } from "../../components/git/CommitPanel";

export function GitWorkspaceCommitPanel({ ctx }: { ctx: GitWorkspaceController }) {
  if (ctx.workspaceTab !== "changes") {
    return null;
  }
  const {
    clientRef,
    syncing,

    commitScope,
    commitMessage,
    amend,
    signoff,
    gpgSign,
    author,
    runChecks,
    setCommitMessage,
    setAmend,
    setSignoff,
    setGpgSign,
    setAuthor,
    setRunChecks,
    setWorkspaceNotification,
    committableFiles,
    activeRepo,
    runMutation,
    commit,
  } = ctx;

  return (
    <>
        <CommitPanel
        files={committableFiles()}
        commitScope={commitScope}
        message={commitMessage}
        amend={amend}
        signoff={signoff}
        gpgSign={gpgSign}
        author={author}
        runChecks={runChecks}
        busy={syncing}
        protectedBranch={activeRepo?.protectedBranch}
        onMessageChange={setCommitMessage}
        onAmendChange={setAmend}
        onSignoffChange={setSignoff}
        onGpgSignChange={setGpgSign}
        onAuthorChange={setAuthor}
        onRunChecksChange={setRunChecks}
        onCommit={() => void commit(false)}
        onCommitAndPush={() => void commit(true)}
        onRunChecks={() =>
          activeRepo &&
          void runMutation(async () => {
            const result = await clientRef.current.runCommitChecks(
              activeRepo.id,
              [...commitScope],
            );
            const issues = result.issues ?? [];
            if (issues.length > 0) {
              setWorkspaceNotification({
                level: result.ok ? "warning" : "error",
                message: `Commit checks: ${issues.length} issue(s)`,
              });
            } else {
              setWorkspaceNotification({
                level: "info",
                message: "Commit checks passed",
              });
            }
          })
        }
        />
    </>
  );
}
