import {
  classifyGitError,
  summarizeGitError,
} from "../shared/errors/classifyGitError";
import type { GitViewErrorCode } from "../shared/errors/codes";

/**
 * Map raw git/exec errors to user-facing messages for Explorer Git menu actions.
 * Classification lives in `shared/errors/classifyGitError`; this module only
 * decides how each class is worded for a menu action.
 */

type Phrase = (actionLabel: string) => string;

const PHRASES: Partial<Record<GitViewErrorCode, Phrase>> = {
  UNRESOLVED_CONFLICTS: (action) =>
    `${action} cannot run while merge conflicts are unresolved. ` +
    "Finish resolving conflicts (or abort the merge/rebase) first.",
  OPERATION_IN_PROGRESS: (action) =>
    `${action} cannot run while a Git operation is in progress. ` +
    "Finish or abort the current merge/rebase first.",
  NO_LOCAL_CHANGES: (action) => `${action}: no local changes to save.`,
  NO_STASH_ENTRIES: (action) => `${action}: no stash entries found.`,
  GIT_EXECUTABLE_NOT_FOUND: (action) =>
    `${action} failed: Git executable not found. ` +
    "Set gitView.gitExecutablePath or install Git.",
  GIT_COMMAND_TIMEOUT: (action) =>
    `${action} timed out. Increase the timeout or try again on a smaller range.`,
  AUTH_REQUIRED: (action) =>
    `${action} failed: authentication required for the remote.`,
  PUSH_REJECTED: (action) =>
    `${action} was rejected by the remote. Pull or fetch first, then retry.`,
};

export function formatGitCommandError(
  err: unknown,
  actionLabel: string,
): string {
  const { code } = classifyGitError(err);
  const phrase = PHRASES[code];
  if (phrase) {
    return phrase(actionLabel);
  }
  return `${actionLabel} failed: ${summarizeGitError(err)}`;
}
