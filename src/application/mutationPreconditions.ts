import type { GitViewStructuredError } from "../shared/errors/codes";
import { createError } from "../shared/errors/codes";
import type { Repository } from "../shared/types/repository";
import type {
  DestructiveAction,
  ProtectionCheckResult,
} from "../services/protectionService";

export type MutationPreconditionContext = {
  trusted: boolean;
  repository: Repository | null;
  protectedCheck?: ProtectionCheckResult;
};

export type MutationPreconditionResult =
  | { ok: true; repository: Repository }
  | { ok: false; error: GitViewStructuredError };

export function requireTrustedWorkspace(
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

export function requireRepository(
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

export function requireProtectedBranchAllowed(
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

export function destructiveActionLabel(action: DestructiveAction): string {
  switch (action) {
    case "force_push":
      return "Force push";
    case "hard_reset":
      return "Hard reset";
    case "history_rewrite":
      return "Rewrite history";
    case "drop_commit":
      return "Drop commit";
    case "force_checkout":
      return "Force checkout";
    case "branch_delete_force":
      return "Force delete branch";
    case "worktree_delete_dirty":
      return "Delete dirty worktree";
  }
}
