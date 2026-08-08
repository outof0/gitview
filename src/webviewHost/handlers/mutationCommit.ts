import { hasUpstream } from "../../services/git/upstream";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { validateRepoRelativePaths } from "../validatePaths";
import { gitCommandError, type MutationHandlerContext } from "./mutationHelpers";

export function createCommitMutationHandlers(ctx: MutationHandlerContext) {
  const { deps, commitApi, sync, validateRepoMutation, refreshAfterMutation, preconditionError } = ctx;
  return {
    async createCommit(
      requestId: string,
      payload: {
        repoId: string;
        message: string;
        paths?: string[];
        amend?: boolean;
        signoff?: boolean;
        gpgSign?: boolean;
        author?: string;
        skipHooks?: boolean;
        runChecks?: boolean;
        skipChecks?: boolean;
        confirmedChecks?: boolean;
        pushAfter?: boolean;
      },
    ) {
      const protectedAction = payload.amend ? "history_rewrite" : undefined;
      const repo = await validateRepoMutation(
        requestId,
        payload.repoId,
        protectedAction,
      );
      if (!repo) {
        return;
      }

      if (payload.paths) {
        const validated = validateRepoRelativePaths(repo.rootPath, payload.paths);
        if (!validated.ok) {
          preconditionError(requestId, {
            code: "INVALID_PATH",
            message: validated.message,
          });
          return;
        }
        payload = { ...payload, paths: validated.paths };
      }

      if (
        payload.runChecks &&
        !payload.skipChecks &&
        deps.commitCheckService &&
        payload.paths &&
        payload.paths.length > 0
      ) {
        const checkResult = await deps.commitCheckService.runChecks(
          repo.rootPath,
          payload.paths,
          { applyFixes: true },
        );
        const warnings = checkResult.issues.filter(
          (issue) => issue.severity === "warning",
        );
        if (!checkResult.ok) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("COMMIT_CHECK_FAILED", "Commit checks failed.", {
                details: { issues: checkResult.issues },
              }),
            ),
          );
          return;
        }
        if (warnings.length > 0 && !payload.confirmedChecks) {
          deps.postMessage(
            createHostError(
              requestId,
              createError(
                "CONFIRMATION_REQUIRED",
                "Commit checks reported warnings.",
                { details: { issues: warnings } },
              ),
            ),
          );
          return;
        }
      }

      try {
        const result = await commitApi.commit(repo.rootPath, {
          message: payload.message,
          paths: payload.paths,
          amend: payload.amend,
          signoff: payload.signoff,
          gpgSign: payload.gpgSign,
          author: payload.author,
          skipHooks: payload.skipHooks,
        });

        let pushed = false;
        let pushRejected = false;
        let upstreamRequired = false;
        if (payload.pushAfter) {
          const needsUpstream = !(await hasUpstream(deps.execGit, repo.rootPath));
          if (needsUpstream) {
            upstreamRequired = true;
          } else {
            const pushResult = await sync.push(repo.rootPath);
            pushed = !pushResult.rejected;
            pushRejected = pushResult.rejected;
          }
        }

        await refreshAfterMutation(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "commit.create", {
            sha: result.sha,
            pushed,
            pushRejected,
            upstreamRequired,
          }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },
  };
}
