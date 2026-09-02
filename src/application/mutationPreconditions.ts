import type { GitViewStructuredError } from "../shared/errors/codes";
import { createError } from "../shared/errors/codes";
import {
  createDropCommitConfirmationEvidence,
  createDropSelectedConfirmationEvidence,
  createForceCheckoutConfirmationEvidence,
  createHardResetConfirmationEvidence,
  createMultiRootForceCheckoutConfirmationEvidence,
  createRemoveDirtyWorktreeConfirmationEvidence,
  createRollbackConfirmationEvidence,
  matchesRepositoryFingerprint,
  matchesRollbackConfirmationPaths,
  matchesSelectedChangesConfirmationSelection,
  matchesWorktreeRemovalTarget,
  type ConfirmationSubmission,
  type WorktreeRemovalTargetFingerprint,
} from "../shared/types/confirmation";
import type { DiffLineSelection } from "../shared/types/diff";
import type { Repository } from "../shared/types/repository";
import type { ProtectionCheckResult } from "../services/protectionService";

export type MutationPreconditionContext = {
  trusted: boolean;
  repository: Repository | null;
  protectedCheck?: ProtectionCheckResult;
};

export type MutationPreconditionResult =
  | { ok: true; repository: Repository }
  | { ok: false; error: GitViewStructuredError };

function requireTrustedWorkspace(
  trusted: boolean,
): MutationPreconditionResult | { ok: true } {
  if (!trusted) {
    return {
      ok: false,
      error: createError(
        "WORKSPACE_UNTRUSTED",
        "Git operations are disabled in untrusted workspaces.",
        { recoverable: false },
      ),
    };
  }
  return { ok: true };
}

function requireRepository(
  repository: Repository | null,
): MutationPreconditionResult {
  if (!repository) {
    return {
      ok: false,
      error: createError(
        "REPOSITORY_NOT_FOUND",
        "No Git repository found for this action.",
      ),
    };
  }
  if (!repository.trusted) {
    return {
      ok: false,
      error: createError(
        "WORKSPACE_UNTRUSTED",
        "Git operations are disabled in untrusted workspaces.",
        { recoverable: false },
      ),
    };
  }
  return { ok: true, repository };
}

function requireProtectedBranchAllowed(
  check: ProtectionCheckResult | undefined,
): MutationPreconditionResult | { ok: true } {
  if (!check || check.allowed) {
    return { ok: true };
  }
  return {
    ok: false,
    error: createError("PROTECTED_BRANCH", check.reason, {
      details: { action: check.action },
    }),
  };
}

export function validateMutationPreconditions(
  context: MutationPreconditionContext,
): MutationPreconditionResult {
  const trust = requireTrustedWorkspace(context.trusted);
  if (!trust.ok) {
    return trust;
  }
  const repository = requireRepository(context.repository);
  if (!repository.ok) {
    return repository;
  }
  const protection = requireProtectedBranchAllowed(context.protectedCheck);
  if (!protection.ok) {
    return protection;
  }
  return repository;
}

export function requireHardResetConfirmation(
  repository: Repository,
  targetSha: string,
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createHardResetConfirmationEvidence(
    repository,
    targetSha,
  );
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Hard reset requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "hard_reset" ||
    evidence.repoId !== repository.id ||
    evidence.targetSha !== targetSha ||
    evidence.resetMode !== "hard" ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    !matchesRepositoryFingerprint(repository, evidence.repository)
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository state changed. Review the reset before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm the hard reset.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}

export function requireDropCommitConfirmation(
  repository: Repository,
  targetSha: string,
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createDropCommitConfirmationEvidence(repository, targetSha);
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Dropping a commit requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "drop_commit" ||
    evidence.repoId !== repository.id ||
    evidence.targetSha !== targetSha ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    !matchesRepositoryFingerprint(repository, evidence.repository)
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository state changed. Review the commit drop before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm the commit drop.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}

export function requireDropSelectedConfirmation(
  repository: Repository,
  targetSha: string,
  path: string,
  selection: { hunkIndexes?: number[]; lines?: DiffLineSelection[] },
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createDropSelectedConfirmationEvidence(
    repository,
    targetSha,
    path,
    selection,
  );
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Dropping selected changes requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "drop_selected" ||
    evidence.repoId !== repository.id ||
    evidence.targetSha !== targetSha ||
    evidence.path !== path ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    !matchesSelectedChangesConfirmationSelection(selection, evidence.selection) ||
    !matchesRepositoryFingerprint(repository, evidence.repository)
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository state changed. Review the selected changes before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm dropping the selected changes.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}

export function requireForceCheckoutConfirmation(
  repository: Repository,
  targetRef: string,
  targetSha: string,
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createForceCheckoutConfirmationEvidence(
    repository,
    targetRef,
    targetSha,
  );
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Force checkout requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "force_checkout" ||
    evidence.repoId !== repository.id ||
    evidence.targetRef !== targetRef ||
    evidence.targetSha !== targetSha ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    !matchesRepositoryFingerprint(repository, evidence.repository)
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository state changed. Review the force checkout before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm the force checkout.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}

export function requireMultiRootForceCheckoutConfirmation(
  initiatingRepository: Repository,
  targetRef: string,
  targets: Array<{ repository: Repository; targetSha: string }>,
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createMultiRootForceCheckoutConfirmationEvidence(
    initiatingRepository,
    targetRef,
    targets,
  );
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Force checkout across repositories requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "force_checkout_multi" ||
    evidence.repoId !== initiatingRepository.id ||
    evidence.targetRef !== targetRef ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    JSON.stringify(evidence.targets) !== JSON.stringify(confirmation.targets) ||
    !matchesRepositoryFingerprint(
      initiatingRepository,
      evidence.repository,
    )
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository state changed. Review the multi-root force checkout before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm the force checkout.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}

export function requireRollbackConfirmation(
  repository: Repository,
  paths: string[],
  unversionedPaths: string[],
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createRollbackConfirmationEvidence(
    repository,
    paths,
    unversionedPaths,
  );
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Rolling back local changes requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "rollback" ||
    evidence.repoId !== repository.id ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    !matchesRollbackConfirmationPaths(paths, unversionedPaths, evidence) ||
    !matchesRepositoryFingerprint(repository, evidence.repository)
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository state changed. Review the rollback before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm the rollback.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}

export function requireDirtyWorktreeRemovalConfirmation(
  repository: Repository,
  target: WorktreeRemovalTargetFingerprint,
  submission?: ConfirmationSubmission,
): { ok: true } | { ok: false; error: GitViewStructuredError } {
  const confirmation = createRemoveDirtyWorktreeConfirmationEvidence(
    repository,
    target,
  );
  if (!submission) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        "Removing a dirty worktree requires typed confirmation.",
        { details: { confirmation } },
      ),
    };
  }

  const evidence = submission.evidence;
  if (
    evidence.action !== "remove_dirty_worktree" ||
    evidence.repoId !== repository.id ||
    evidence.expectedTypedValue !== confirmation.expectedTypedValue ||
    !matchesWorktreeRemovalTarget(target, evidence.target) ||
    !matchesRepositoryFingerprint(repository, evidence.repository)
  ) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_STALE",
        "Repository or worktree state changed. Review the removal before confirming again.",
        { details: { confirmation } },
      ),
    };
  }

  if (submission.typedValue !== evidence.expectedTypedValue) {
    return {
      ok: false,
      error: createError(
        "CONFIRMATION_REQUIRED",
        `Type ${evidence.expectedTypedValue} to confirm removing the worktree.`,
        { details: { confirmation } },
      ),
    };
  }

  return { ok: true };
}
