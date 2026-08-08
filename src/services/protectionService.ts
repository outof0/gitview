export type DestructiveAction =
  | "force_push"
  | "hard_reset"
  | "history_rewrite"
  | "drop_commit"
  | "force_checkout"
  | "branch_delete_force"
  | "worktree_delete_dirty";

export type ProtectionCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; action: DestructiveAction };

function escapeRegexChar(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split("*").map(escapeRegexChar);
  return new RegExp(`^${parts.join(".*")}$`);
}

export function isProtectedBranch(
  branchName: string | null,
  patterns: string[],
): boolean {
  if (!branchName) {
    return false;
  }
  return patterns.some((pattern) => patternToRegex(pattern).test(branchName));
}

export function checkDestructiveAction(
  branchName: string | null,
  patterns: string[],
  action: DestructiveAction,
): ProtectionCheckResult {
  if (!isProtectedBranch(branchName, patterns)) {
    return { allowed: true };
  }

  const blocked: DestructiveAction[] = [
    "force_push",
    "hard_reset",
    "history_rewrite",
    "drop_commit",
  ];

  if (!blocked.includes(action)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    action,
    reason: `Branch "${branchName}" is protected. This action is blocked.`,
  };
}

export type ProtectionService = {
  /** Current patterns (copy). Prefer `updatePatterns` to hot-reload. */
  readonly patterns: string[];
  updatePatterns: (next: string[]) => void;
  isProtectedBranch: (branchName: string | null) => boolean;
  checkDestructiveAction: (
    branchName: string | null,
    action: DestructiveAction,
  ) => ProtectionCheckResult;
};

/**
 * Creates a protection service whose pattern list can be updated in place.
 * Routers hold a stable reference; call `updatePatterns` when settings change
 * so checks pick up new rules without recreating the object graph.
 */
export function createProtectionService(patterns: string[]): ProtectionService {
  let currentPatterns = [...patterns];
  return {
    get patterns() {
      return [...currentPatterns];
    },
    updatePatterns(next: string[]) {
      currentPatterns = [...next];
    },
    isProtectedBranch: (branchName: string | null) =>
      isProtectedBranch(branchName, currentPatterns),
    checkDestructiveAction: (
      branchName: string | null,
      action: DestructiveAction,
    ) => checkDestructiveAction(branchName, currentPatterns, action),
  };
}