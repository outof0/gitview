/** Structured error codes for host ↔ webview protocol and command handlers. */

/**
 * Single source of truth. `GitViewErrorCode` is derived from this list so a new
 * code can never be added to the type without also being runtime-validatable.
 */
const GITVIEW_ERROR_CODE_LIST = [
  "PROTOCOL_VERSION_UNSUPPORTED",
  "INVALID_REQUEST",
  "WORKSPACE_UNTRUSTED",
  "REPOSITORY_NOT_FOUND",
  "REPOSITORY_AMBIGUOUS",
  "INVALID_PATH",
  "INVALID_REF",
  "PROTECTED_BRANCH",
  "GIT_EXECUTABLE_NOT_FOUND",
  "GIT_VERSION_UNSUPPORTED",
  "GIT_COMMAND_FAILED",
  "GIT_COMMAND_TIMEOUT",
  "OPERATION_IN_PROGRESS",
  "DESTRUCTIVE_ACTION_DENIED",
  "CONFIRMATION_REQUIRED",
  "BRANCH_NOT_FULLY_MERGED",
  "NOT_IMPLEMENTED",
  "COMMIT_CHECK_FAILED",
  "DIFF_TOO_LARGE",
  "MALFORMED_CONFLICT",
  "NOT_UNMERGED",
  "RENAME_CONFLICT",
  "BINARY_CONFLICT",
  "MARKERS_REMAIN",
  "SAVE_FAILED",
  "UNRESOLVED_CONFLICTS",
  "NO_LOCAL_CHANGES",
  "NO_STASH_ENTRIES",
  "PUSH_REJECTED",
  "WORKTREE_DIRTY",
  "PATH_NOT_AT_REF",
  "BINARY_FILE",
  "AUTH_REQUIRED",
] as const;

export type GitViewErrorCode = (typeof GITVIEW_ERROR_CODE_LIST)[number];

export type GitViewStructuredError = {
  code: GitViewErrorCode;
  message: string;
  recoverable: boolean;
  details?: unknown;
};

const GITVIEW_ERROR_CODES: ReadonlySet<string> = new Set<GitViewErrorCode>(
  GITVIEW_ERROR_CODE_LIST,
);

export function isGitViewStructuredError(
  value: unknown,
): value is GitViewStructuredError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const error = value as Partial<GitViewStructuredError>;
  return (
    typeof error.code === "string" &&
    GITVIEW_ERROR_CODES.has(error.code) &&
    typeof error.message === "string" &&
    typeof error.recoverable === "boolean"
  );
}

export function createError(
  code: GitViewErrorCode,
  message: string,
  opts?: { recoverable?: boolean; details?: unknown },
): GitViewStructuredError {
  return {
    code,
    message,
    recoverable: opts?.recoverable ?? code !== "WORKSPACE_UNTRUSTED",
    details: opts?.details,
  };
}
