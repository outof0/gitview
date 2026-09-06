import {
  requireForceCheckoutConfirmation,
  requireMultiRootForceCheckoutConfirmation,
} from "../../application/mutationPreconditions";
import { readGitWorkspaceSettings } from "../../config/readGitWorkspaceSettings";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type { ConfirmationSubmission } from "../../shared/types/confirmation";
import { gitCommandError, type BranchHandlerContext } from "./branchHelpers";

export function createBranchCheckoutHandlers(ctx: BranchHandlerContext) {
  const {
    deps,
    branches,
    syncBranchOperation,
    discoverRepos,
    resolveRepo,
    validateRepo,
    emitBranchSnapshot,
  } = ctx;
  return {
    async list(requestId: string, repoId: string) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }
      await emitBranchSnapshot(repo, requestId, "branch.list");
    },

    async checkout(
      requestId: string,
      repoId: string,
      ref: string,
      opts?: {
        smart?: boolean;
        force?: boolean;
        confirmation?: ConfirmationSubmission;
      },
    ) {
      const repo = await validateRepo(requestId, repoId, Boolean(opts?.force));
      if (!repo) {
        return;
      }
      const targetRef = ref.trim();
      if (!targetRef) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
          ),
        );
        return;
      }
      if (opts?.force) {
        const [target] = await syncBranchOperation.planTargets([repo], targetRef);
        if (!target?.available || !target.targetSha) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("INVALID_REF", `Branch "${targetRef}" is not available.`),
            ),
          );
          return;
        }
        const confirmationCheck = requireForceCheckoutConfirmation(
          repo,
          targetRef,
          target.targetSha,
          opts.confirmation,
        );
        if (!confirmationCheck.ok) {
          deps.postMessage(createHostError(requestId, confirmationCheck.error));
          return;
        }
      }
      const checkoutOptions = { smart: opts?.smart, force: opts?.force };
      try {
        // Ask git what the ref is. `targetRef.includes("/")` treated the
        // perfectly ordinary local branch `feature/login` as a remote and
        // checked it out as a new branch named `login`.
        if ((await branches.resolveRefKind(repo.rootPath, targetRef)) === "remote") {
          await branches.checkoutRemoteAsTracking(
            repo.rootPath,
            targetRef,
            checkoutOptions,
          );
        } else {
          await branches.checkout(repo.rootPath, targetRef, checkoutOptions);
        }
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.checkout", { ref: targetRef }),
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

    async syncOperation(
      requestId: string,
      repoId: string,
      ref: string,
      opts?: {
        smart?: boolean;
        force?: boolean;
        confirmed?: boolean;
        confirmation?: ConfirmationSubmission;
      },
    ) {
      const settings = readGitWorkspaceSettings();
      const allRepos = await discoverRepos();
      const targetRef = ref.trim();
      if (!targetRef) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
          ),
        );
        return;
      }

      if (allRepos.length <= 1 || !settings.synchronousBranchControl) {
        const repo = await validateRepo(requestId, repoId, Boolean(opts?.force));
        if (!repo) {
          return;
        }
        if (opts?.force) {
          const [target] = await syncBranchOperation.planTargets(
            [repo],
            targetRef,
          );
          if (!target?.available || !target.targetSha) {
            deps.postMessage(
              createHostError(
                requestId,
                createError(
                  "INVALID_REF",
                  `Branch "${targetRef}" is not available.`,
                ),
              ),
            );
            return;
          }
          const confirmationCheck = requireForceCheckoutConfirmation(
            repo,
            targetRef,
            target.targetSha,
            opts.confirmation,
          );
          if (!confirmationCheck.ok) {
            deps.postMessage(createHostError(requestId, confirmationCheck.error));
            return;
          }
        }
        const checkoutOptions = { smart: opts?.smart, force: opts?.force };
        try {
          // Same classification as the single-repo checkout above: a ref
          // containing "/" can still be an ordinary local branch such as
          // `feature/login`, and spelling-based checks check it out as a new
          // branch named after its last path segment.
          if (
            (await branches.resolveRefKind(repo.rootPath, targetRef)) ===
            "remote"
          ) {
            await branches.checkoutRemoteAsTracking(
              repo.rootPath,
              targetRef,
              checkoutOptions,
            );
          } else {
            await branches.checkout(repo.rootPath, targetRef, checkoutOptions);
          }
          await deps.refreshCoordinator.refreshNow(repo.id);
          deps.postMessage(
            createHostResponse(requestId, "branch.syncOperation", {
              ref: targetRef,
              results: [{ repoId: repo.id, name: repo.name, ok: true }],
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
        return;
      }

      const initiating = await validateRepo(
        requestId,
        repoId,
        Boolean(opts?.force),
      );
      if (!initiating) {
        return;
      }

      const targets = await syncBranchOperation.planTargets(allRepos, targetRef);
      const applicable = targets.filter((target) => target.available);
      if (applicable.length === 0) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_REF",
              `Branch "${targetRef}" is not available in any workspace repository.`,
              { details: { targets } },
            ),
          ),
        );
        return;
      }

      if (opts?.force) {
        const repoById = new Map(allRepos.map((repo) => [repo.id, repo]));
        const confirmationTargets: Array<{
          repository: (typeof allRepos)[number];
          targetSha: string;
        }> = [];
        for (const target of applicable) {
          const repository = repoById.get(target.repoId);
          if (!repository || !target.targetSha) {
            continue;
          }
          const protection = deps.protectionService.checkDestructiveAction(
            repository.currentBranch,
            "force_checkout",
          );
          if (!protection.allowed) {
            deps.postMessage(
              createHostError(
                requestId,
                createError("PROTECTED_BRANCH", protection.reason, {
                  details: { action: protection.action, repoId: repository.id },
                }),
              ),
            );
            return;
          }
          confirmationTargets.push({ repository, targetSha: target.targetSha });
        }
        if (confirmationTargets.length !== applicable.length) {
          deps.postMessage(
            createHostError(
              requestId,
              createError(
                "INVALID_REF",
                `Branch "${targetRef}" changed while preparing checkout.`,
              ),
            ),
          );
          return;
        }
        const confirmationCheck = requireMultiRootForceCheckoutConfirmation(
          initiating,
          targetRef,
          confirmationTargets,
          opts.confirmation,
        );
        if (!confirmationCheck.ok) {
          deps.postMessage(createHostError(requestId, confirmationCheck.error));
          return;
        }
      } else if (!opts?.confirmed) {
        deps.postMessage(
          createHostResponse(requestId, "branch.syncOperation", {
            confirmationRequired: true,
            ref: targetRef,
            targets,
          }),
        );
        return;
      }

      try {
        const results = await syncBranchOperation.execute(
          allRepos,
          targetRef,
          {
            smart: opts?.smart,
            force: opts?.force,
          },
          targets,
        );
        await deps.refreshCoordinator.refreshNow();
        deps.postMessage(
          createHostResponse(requestId, "branch.syncOperation", {
            ref: targetRef,
            results,
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