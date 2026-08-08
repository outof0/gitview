import type { GitViewErrorCode } from "./codes";

/**
 * The only place in the codebase that interprets Git's human-readable output.
 *
 * Git localizes these diagnostics, so every pattern here is only reliable
 * because `src/services/git/exec.ts` pins the child process to the C locale.
 * Adding a caller that reads stderr directly reintroduces the locale bug this
 * module exists to contain.
 */

export type GitErrorClassification = {
  code: GitViewErrorCode;
  /** True when retrying verbatim cannot succeed until the user acts. */
  needsUserAction: boolean;
};

type Rule = {
  code: GitViewErrorCode;
  pattern: RegExp;
  needsUserAction: boolean;
};

/** Ordered: the first match wins, so specific rules precede general ones. */
const RULES: readonly Rule[] = [
  {
    code: "GIT_EXECUTABLE_NOT_FOUND",
    pattern: /\bENOENT\b.*\bgit\b|\bspawn\b.*\bENOENT\b/i,
    needsUserAction: true,
  },
  {
    code: "GIT_COMMAND_TIMEOUT",
    pattern: /\bETIMEDOUT\b|\bSIGTERM\b/,
    needsUserAction: false,
  },
  {
    code: "AUTH_REQUIRED",
    pattern:
      /could not read Username|Authentication failed|Permission denied \(publickey\)|terminal prompts disabled|invalid username or password/i,
    needsUserAction: true,
  },
  {
    code: "UNRESOLVED_CONFLICTS",
    pattern:
      /could not write index|needs merge|unmerged paths|You have unmerged paths|index contains unmerged entries/i,
    needsUserAction: true,
  },
  {
    code: "OPERATION_IN_PROGRESS",
    pattern:
      /You are in the middle of a (merge|rebase|cherry-pick|revert)|MERGE_HEAD|REBASE_HEAD|CHERRY_PICK_HEAD|REVERT_HEAD/i,
    needsUserAction: true,
  },
  {
    code: "BRANCH_NOT_FULLY_MERGED",
    pattern: /is not fully merged|not fully merged/i,
    needsUserAction: true,
  },
  {
    code: "PUSH_REJECTED",
    pattern: /\brejected\b|non-fast-forward|fetch first|Updates were rejected/i,
    needsUserAction: true,
  },
  {
    code: "NO_LOCAL_CHANGES",
    pattern: /No local changes to save|no changes added to commit/i,
    needsUserAction: false,
  },
  {
    code: "NO_STASH_ENTRIES",
    pattern: /No stash entries found|No stash found/i,
    needsUserAction: false,
  },
  {
    code: "WORKTREE_DIRTY",
    pattern: /contains modified or untracked files|\bis dirty\b/i,
    needsUserAction: true,
  },
  {
    code: "PATH_NOT_AT_REF",
    pattern:
      /no such path|exists on disk, but not in|bad revision|fatal: path|unknown revision or path not in the working tree/i,
    needsUserAction: false,
  },
  {
    code: "BINARY_FILE",
    pattern: /\bbinary\b/i,
    needsUserAction: false,
  },
  {
    code: "PROTECTED_BRANCH",
    pattern: /protected branch|pre-receive hook declined/i,
    needsUserAction: true,
  },
];

function toText(error: unknown): string {
  if (error instanceof Error) {
    const withStreams = error as Error & { stderr?: unknown; stdout?: unknown };
    const stderr =
      typeof withStreams.stderr === "string" ? withStreams.stderr : "";
    return `${error.message}\n${stderr}`;
  }
  return String(error);
}

export function classifyGitError(error: unknown): GitErrorClassification {
  const text = toText(error);
  const matched = RULES.find((rule) => rule.pattern.test(text));
  return (
    matched ?? { code: "GIT_COMMAND_FAILED", needsUserAction: false }
  );
}

export function isGitErrorCode(error: unknown, code: GitViewErrorCode): boolean {
  return classifyGitError(error).code === code;
}

/**
 * Git prefixes diagnostics with `error:`/`fatal:` and often emits several
 * lines; the last meaningful line is the actionable one.
 */
export function summarizeGitError(error: unknown): string {
  const text = toText(error).trim();
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^(?:error|fatal|warning):\s*/i, "").trim())
    .filter(Boolean);
  return lines[lines.length - 1] || text || "Unknown error";
}
