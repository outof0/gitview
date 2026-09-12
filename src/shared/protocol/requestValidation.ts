import { isGitMenuAction, isRepoWideGitMenuAction } from "../../types/gitMenu";
import { isConfirmationSubmission } from "../types/confirmation";
import { isSafeGitOperand } from "../lib/gitOperand";
import type { WebviewToHost } from "./webviewToHost";
import { PROTOCOL_VERSION } from "./base";
import type { ExtensionWebviewRequest } from "./extensions";
import { isExtensionRequestType } from "./extensions";

export type ProtocolPayloadValidator = (value: unknown) => boolean;
type Validator = ProtocolPayloadValidator;
type RequestType = WebviewToHost["type"];
type RequestValidatorMap = { [Type in RequestType]: Validator };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const stringValue: Validator = (value) => typeof value === "string";
const nonEmptyString: Validator = (value) =>
  typeof value === "string" && value.length > 0;
const gitOperand: Validator = isSafeGitOperand;
/**
 * A git operand, or an explicit empty string — callers use `""` to mean "no ref,
 * use the working tree". Still rejects anything starting with `-`, so an
 * optional ref cannot be turned into a git option.
 */
const optionalGitOperand: Validator = (value) =>
  value === "" || isSafeGitOperand(value);
const booleanValue: Validator = (value) => typeof value === "boolean";
const nonNegativeInteger: Validator = (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const positiveInteger: Validator = (value) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

function oneOf(...values: readonly unknown[]): Validator {
  const allowed = new Set(values);
  return (value) => allowed.has(value);
}

function arrayOf(item: Validator): Validator {
  return (value) => Array.isArray(value) && value.every(item);
}

const stringArray = arrayOf(stringValue);
const gitOperandArray = arrayOf(gitOperand);
const nonNegativeIntegerArray = arrayOf(nonNegativeInteger);

function shape(
  required: Record<string, Validator> = {},
  optional: Record<string, Validator> = {},
  exact = false,
): Validator {
  return (value) => {
    if (!isRecord(value)) {
      return false;
    }
    for (const [key, validator] of Object.entries(required)) {
      if (!(key in value) || !validator(value[key])) {
        return false;
      }
    }
    for (const [key, validator] of Object.entries(optional)) {
      if (value[key] !== undefined && !validator(value[key])) {
        return false;
      }
    }
    if (exact) {
      const allowed = new Set([
        ...Object.keys(required),
        ...Object.keys(optional),
      ]);
      return Object.keys(value).every((key) => allowed.has(key));
    }
    return true;
  };
}

const emptyPayload = shape({}, {}, true);
const repoOnly = shape({ repoId: stringValue });
const repoPath = shape({ repoId: stringValue, path: stringValue });
const repoPaths = shape({ repoId: stringValue, paths: stringArray });
const repoSha = shape({ repoId: stringValue, sha: gitOperand });
const repoShas = shape({ repoId: stringValue, shas: gitOperandArray });
const repoName = shape({ repoId: stringValue, name: stringValue });
const repoIndex = shape({ repoId: stringValue, index: nonNegativeInteger });

const lineSelection = shape({
  side: oneOf("old", "new"),
  line: nonNegativeInteger,
});
const lineSelections = arrayOf(lineSelection);
const reviewFilters = shape(
  {},
  {
    state: oneOf("open", "closed", "all"),
    author: stringValue,
    label: stringValue,
    assignee: stringValue,
    milestone: stringValue,
    sort: oneOf("updated", "created"),
    search: stringValue,
  },
);
/**
 * Lexical repo-relative path check (protocol layer cannot resolve the repo
 * root, so containment against the real repository happens at the
 * command/service boundary). Rejects absolute paths, `..` segments, and
 * empty/current-dir segments — the shapes that become option injection or
 * cross-repository resolution downstream.
 */
function isRepoContainedRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (value.startsWith("/") || value.startsWith("\\")) {
    return false;
  }
  if (value.includes("\0") || value.includes("\r") || value.includes("\n")) {
    return false;
  }
  const normalized = value.replace(/\\/g, "/");
  if (
    normalized === "." ||
    normalized === "./" ||
    normalized.endsWith("/")
  ) {
    return false;
  }
  const segments = normalized.split("/");
  return segments.every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

const repoContainedPath: Validator = isRepoContainedRelativePath;
const repoContainedPathArray: Validator = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(isRepoContainedRelativePath);

const MENU_SHA_ACTIONS = new Set([
  "cherryPick",
  "revertCommit",
  "checkoutRevision",
  "copyCommitId",
  "getFromRevision",
  "compareWithLocal",
  "showRevisionDiff",
  "openOnRemote",
  "copyRemoteLink",
  "copyRemoteLinkMarkdown",
]);

const MENU_PATH_REQUIRED_ACTIONS = new Set([
  "getFromRevision",
  "openFile",
  "compareWithLocal",
  "showRevisionDiff",
]);

/**
 * Actions that silently no-op in the dispatcher without a SHA (each is
 * guarded by `if (commitSha)`). Accepting them sha-less would acknowledge
 * `{ok: true}` for work that never happened.
 */
const MENU_SHA_REQUIRED_ACTIONS = new Set([
  "cherryPick",
  "revertCommit",
  "checkoutRevision",
  "getFromRevision",
  "compareWithLocal",
  "showRevisionDiff",
]);

const MENU_MESSAGE_ACTIONS = new Set(["copyCommitMessage"]);

function isValidGitMenuActionPayload(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const { repoId, action } = value;
  if (typeof repoId !== "string" || repoId.length === 0) {
    return false;
  }
  if (typeof action !== "string" || !isGitMenuAction(action)) {
    return false;
  }
  const allowed = new Set([
    "repoId",
    "action",
    "relativePath",
    "selectedPaths",
    "commitSha",
    "commitMessage",
    "isFolder",
    "reuseDiffPanel",
    "openInActiveColumn",
  ]);
  if (!Object.keys(value).every((key) => allowed.has(key))) {
    return false;
  }
  const { relativePath, selectedPaths, commitSha, commitMessage, isFolder } = value as Record<
    string,
    unknown
  >;
  if (
    selectedPaths !== undefined &&
    (!Array.isArray(selectedPaths) ||
      selectedPaths.length === 0 ||
      !selectedPaths.every(isRepoContainedRelativePath) ||
      action !== "rollback")
  ) {
    return false;
  }
  if (
    value.reuseDiffPanel !== undefined &&
    typeof value.reuseDiffPanel !== "boolean"
  ) {
    return false;
  }
  if (
    value.openInActiveColumn !== undefined &&
    typeof value.openInActiveColumn !== "boolean"
  ) {
    return false;
  }
  if (isFolder !== undefined && typeof isFolder !== "boolean") {
    return false;
  }
  if (isRepoWideGitMenuAction(action)) {
    // Command-only actions carry no file/commit operands over the protocol;
    // anything else is a trust-boundary escape.
    return (
      relativePath === undefined &&
      selectedPaths === undefined &&
      commitSha === undefined &&
      commitMessage === undefined
    );
  }
  if (relativePath !== undefined && !isRepoContainedRelativePath(relativePath)) {
    return false;
  }
  if (commitSha !== undefined && !isSafeGitOperand(commitSha)) {
    return false;
  }
  if (commitMessage !== undefined) {
    if (!MENU_MESSAGE_ACTIONS.has(action)) {
      return false;
    }
    if (typeof commitMessage !== "string") {
      return false;
    }
  }
  if (commitSha !== undefined && !MENU_SHA_ACTIONS.has(action)) {
    return false;
  }
  if (MENU_PATH_REQUIRED_ACTIONS.has(action)) {
    if (!isRepoContainedRelativePath(relativePath)) {
      return false;
    }
    // getFromRevision / compareWithLocal / showRevisionDiff require BOTH a
    // path and a SHA. Returning after the path check alone accepts a valid
    // path with a missing SHA, which the dispatcher then silently no-ops on
    // while acknowledging success.
    if (MENU_SHA_REQUIRED_ACTIONS.has(action)) {
      return typeof commitSha === "string" && isSafeGitOperand(commitSha);
    }
    return true;
  }
  if (action === "copyCommitId") {
    return typeof commitSha === "string";
  }
  if (MENU_SHA_REQUIRED_ACTIONS.has(action)) {
    return typeof commitSha === "string";
  }
  if (action === "copyCommitMessage") {
    return typeof commitMessage === "string";
  }
  return true;
}
const discardAction: Validator = (value) => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.action === "backToList") {
    return true;
  }
  return (
    value.action === "openFile" &&
    stringValue(value.relativePath) &&
    oneOf("first", "last")(value.targetChange)
  );
};
const commitCheckKinds = arrayOf(
  oneOf("hooks", "todo", "analyze", "reformat", "optimizeImports"),
);
const selectedChanges = shape(
  { repoId: stringValue, sha: gitOperand, path: stringValue },
  {
    hunkIndexes: nonNegativeIntegerArray,
    lines: lineSelections,
    checkOnly: booleanValue,
    confirmed: booleanValue,
  },
);
const dropSelectedChanges = shape(
  { repoId: stringValue, sha: gitOperand, path: stringValue },
  {
    hunkIndexes: nonNegativeIntegerArray,
    lines: lineSelections,
    confirmed: booleanValue,
    confirmation: isConfirmationSubmission,
  },
);
const reviewTarget = shape({
  repoId: stringValue,
  providerId: stringValue,
  reviewId: stringValue,
});

const requestValidators = {
  "webview.ready": shape({ surface: stringValue }),
  "workspace.openFolder": shape({}),
  "workspace.clone": shape({}),
  "workspace.manageTrust": shape({}),
  "workspace.collapsePanel": emptyPayload,
  "workspace.toggleSidebar": emptyPayload,
  "repository.addRemote": shape({ repoId: stringValue }),
  "repo.refresh": shape({}, { repoId: stringValue }),
  "status.list": shape(
    { repoId: stringValue },
    { includeIgnored: booleanValue },
  ),
  "changes.stage": repoPaths,
  "changes.unstage": repoPaths,
  "changes.rollback": shape(
    { repoId: stringValue, paths: stringArray },
    {
      confirmed: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "commit.create": shape(
    { repoId: stringValue, message: stringValue },
    {
      paths: stringArray,
      amend: booleanValue,
      signoff: booleanValue,
      gpgSign: booleanValue,
      author: stringValue,
      skipHooks: booleanValue,
      runChecks: booleanValue,
      skipChecks: booleanValue,
      confirmedChecks: booleanValue,
      pushAfter: booleanValue,
    },
  ),
  "sync.fetch": repoOnly,
  "sync.pull": shape(
    { repoId: stringValue },
    { strategy: oneOf("merge", "rebase", "ff_only") },
  ),
  "sync.push": shape(
    { repoId: stringValue },
    { setUpstream: booleanValue, remote: gitOperand },
  ),
  "sync.updateAllRoots": shape(
    {},
    { strategy: oneOf("merge", "rebase", "ff_only") },
  ),
  "sync.cancel": shape({ operationId: nonEmptyString }, {}, true),
  "branch.list": repoOnly,
  "branch.checkout": shape(
    { repoId: stringValue, ref: gitOperand },
    {
      smart: booleanValue,
      force: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "branch.syncOperation": shape(
    { repoId: stringValue, ref: gitOperand },
    {
      smart: booleanValue,
      force: booleanValue,
      confirmed: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "branch.create": shape(
    { repoId: stringValue, name: gitOperand },
    { startPoint: gitOperand, checkout: booleanValue, force: booleanValue },
  ),
  "branch.rename": shape({
    repoId: stringValue,
    oldName: gitOperand,
    newName: gitOperand,
  }),
  "branch.delete": shape(
    { repoId: stringValue, name: gitOperand },
    { force: booleanValue },
  ),
  "branch.push": shape(
    { repoId: stringValue, name: gitOperand },
    { remote: gitOperand, setUpstream: booleanValue },
  ),
  "branch.favorite": repoName,
  "branch.compareCurrent": shape(
    { repoId: stringValue, ref: gitOperand },
    { path: stringValue },
  ),
  "branch.compareWorkingTree": shape(
    { repoId: stringValue, ref: gitOperand },
    { path: stringValue },
  ),
  "branch.compareFile": shape({
    repoId: stringValue,
    ref: gitOperand,
    path: stringValue,
    mode: oneOf("current", "workingTree"),
  }),
  "branch.compareApplyFile": shape({
    repoId: stringValue,
    ref: gitOperand,
    path: stringValue,
    mode: oneOf("current", "workingTree"),
  }),
  "branch.merge": shape(
    { repoId: stringValue, ref: gitOperand },
    {
      noFf: booleanValue,
      squash: booleanValue,
      message: stringValue,
      noCommit: booleanValue,
      log: booleanValue,
    },
  ),
  "branch.rebaseOnto": shape(
    { repoId: stringValue, onto: gitOperand },
    {
      interactive: booleanValue,
      from: gitOperand,
      rebaseMerges: booleanValue,
    },
  ),
  "operation.continue": repoOnly,
  "operation.skip": repoOnly,
  "operation.abort": repoOnly,
  "diff.open": shape(
    { repoId: stringValue, path: stringValue },
    { staged: booleanValue },
  ),
  "diff.numstat": shape(
    { repoId: stringValue },
    { paths: stringArray, ref: optionalGitOperand },
  ),
  "diff.annotate": shape(
    { relativePath: stringValue },
    { focusLine: positiveInteger },
  ),
  "changelist.create": repoName,
  "changelist.activate": shape({ repoId: stringValue, listId: stringValue }),
  "changelist.moveFiles": shape({
    repoId: stringValue,
    listId: stringValue,
    paths: stringArray,
  }),
  "log.dag": repoOnly,
  "log.query": shape(
    { repoId: stringValue },
    {
      branch: stringValue,
      limit: positiveInteger,
      skip: nonNegativeInteger,
      author: stringValue,
      since: stringValue,
      until: stringValue,
      path: stringValue,
      isFolder: booleanValue,
      scope: oneOf("repo"),
      grep: stringValue,
      range: oneOf("all", "incoming", "outgoing"),
      noMerges: booleanValue,
      firstParent: booleanValue,
      collapseLinear: booleanValue,
      graphSort: oneOf("date", "topological"),
      highlightCurrentBranch: booleanValue,
      compactRows: booleanValue,
    },
  ),
  "log.fileDiff": shape(
    { repoId: stringValue, sha: stringValue, path: stringValue },
    { status: stringValue },
  ),
  "log.commitDetail": repoSha,
  "log.fileAtRevision": shape({
    repoId: stringValue,
    sha: stringValue,
    path: stringValue,
  }),
  "git.menuAction": isValidGitMenuActionPayload,
  "rollback.openPanel": shape(
    { repoId: stringValue, path: repoContainedPath },
    { selectedPaths: repoContainedPathArray },
  ),
  "git.openContentDialog": shape(
    { repoId: stringValue, dialog: oneOf("stash", "unstash") },
    { index: (value) => value === null || nonNegativeInteger(value) },
    true,
  ),
  "diff.stageHunk": shape({
    repoId: stringValue,
    path: stringValue,
    hunkIndex: nonNegativeInteger,
  }),
  "diff.unstageHunk": shape({
    repoId: stringValue,
    path: stringValue,
    hunkIndex: nonNegativeInteger,
  }),
  "diff.stageLines": shape({
    repoId: stringValue,
    path: stringValue,
    lines: lineSelections,
  }),
  "diff.unstageLines": shape({
    repoId: stringValue,
    path: stringValue,
    lines: lineSelections,
  }),
  "log.cherryPick": repoSha,
  "log.cherryPickMultiple": repoShas,
  "log.cherryPickSelected": selectedChanges,
  "log.revert": repoSha,
  "log.revertMultiple": repoShas,
  "log.revertSelected": selectedChanges,
  "log.dropSelectedChanges": dropSelectedChanges,
  "log.reset": shape(
    {
      repoId: stringValue,
      sha: gitOperand,
      mode: oneOf("soft", "mixed", "hard", "keep"),
    },
    {
      confirmed: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "log.undoLastCommit": shape(
    { repoId: stringValue },
    { confirmed: booleanValue },
  ),
  "log.createBranchFromCommit": shape({
    repoId: stringValue,
    name: gitOperand,
    sha: gitOperand,
  }),
  "log.dropCommit": shape(
    { repoId: stringValue, sha: gitOperand },
    {
      confirmed: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "log.editMessage": shape(
    { repoId: stringValue, sha: gitOperand, message: stringValue },
    { confirmed: booleanValue },
  ),
  "log.rewrite": shape(
    {
      repoId: stringValue,
      sha: gitOperand,
      action: oneOf("squash", "fixup", "drop"),
    },
    {
      confirmed: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "log.extractChanges": shape(
    { repoId: stringValue, sha: stringValue },
    { paths: stringArray },
  ),
  "rebase.continue": repoOnly,
  "rebase.skip": repoOnly,
  "rebase.abort": repoOnly,
  "commit.checks": shape(
    { repoId: stringValue },
    { paths: stringArray, kinds: commitCheckKinds },
  ),
  "blame.query": shape(
    { repoId: stringValue, path: stringValue },
    { ref: optionalGitOperand },
  ),
  "file.write": shape({
    repoId: stringValue,
    path: stringValue,
    content: stringValue,
  }),
  "conflict.acceptLocal": repoPaths,
  "conflict.acceptIncoming": repoPaths,
  "conflict.openMerge": repoPath,
  "conflict.applyNonConflicting": repoOnly,
  "conflict.refresh": repoOnly,
  "merge.openFile": repoPath,
  "merge.save": shape({
    repoId: stringValue,
    path: stringValue,
    content: stringValue,
  }),
  "merge.markResolved": shape({
    repoId: stringValue,
    path: stringValue,
    content: stringValue,
  }),
  "merge.confirmDiscard": shape({ repoId: stringValue, action: discardAction }),
  "merge.close": emptyPayload,
  "history.openPanel": shape({
    repoId: stringValue,
    path: stringValue,
    isFolder: booleanValue,
  }),
  "log.changesFromSide": shape(
    { repoId: stringValue, side: oneOf("ours", "theirs") },
    {
      relativePath: stringValue,
      filterByFile: booleanValue,
      limit: positiveInteger,
    },
  ),
  "stash.list": repoOnly,
  "stash.push": shape(
    { repoId: stringValue },
    {
      message: stringValue,
      paths: stringArray,
      includeUntracked: booleanValue,
      keepIndex: booleanValue,
    },
  ),
  "stash.detail": repoIndex,
  "stash.fileDiff": shape(
    { repoId: stringValue, index: nonNegativeInteger, path: stringValue },
    { origin: oneOf("tracked", "untracked", "index") },
  ),
  "stash.apply": shape(
    { repoId: stringValue, index: nonNegativeInteger },
    { reinstateIndex: booleanValue },
  ),
  "stash.pop": shape(
    { repoId: stringValue, index: nonNegativeInteger },
    { reinstateIndex: booleanValue },
  ),
  "stash.drop": repoIndex,
  "stash.branch": shape({
    repoId: stringValue,
    index: nonNegativeInteger,
    branch: stringValue,
  }),
  "stash.clear": repoOnly,
  "shelf.list": repoOnly,
  "shelf.files": shape(
    { repoId: stringValue, paths: stringArray },
    { name: stringValue, changelistId: stringValue },
  ),
  "shelf.hunk": shape(
    {
      repoId: stringValue,
      path: stringValue,
      hunkIndex: nonNegativeInteger,
    },
    {
      staged: booleanValue,
      name: stringValue,
      changelistId: stringValue,
    },
  ),
  "shelf.unshelve": shape(
    { repoId: stringValue, shelfId: stringValue },
    { deleteAfter: booleanValue },
  ),
  "shelf.delete": shape({ repoId: stringValue, shelfId: stringValue }),
  "patch.create": shape({ repoId: stringValue }, { paths: stringArray }),
  "patch.apply": shape(
    { repoId: stringValue, patch: stringValue },
    {
      checkOnly: booleanValue,
      confirmed: booleanValue,
      strip: nonNegativeInteger,
      directory: stringValue,
    },
  ),
  "shelf.importPatch": shape(
    { repoId: stringValue, patch: stringValue },
    { name: stringValue },
  ),
  "tag.list": repoOnly,
  "tag.createAnnotated": shape(
    { repoId: stringValue, name: gitOperand },
    { message: stringValue, sha: gitOperand },
  ),
  "tag.checkout": shape({ repoId: stringValue, name: gitOperand }),
  "tag.push": shape(
    { repoId: stringValue, name: gitOperand },
    { remote: gitOperand },
  ),
  "tag.delete": shape({ repoId: stringValue, name: gitOperand }),
  "worktree.list": repoOnly,
  "worktree.add": shape(
    { repoId: stringValue, path: stringValue },
    { branch: stringValue, newBranch: stringValue },
  ),
  "worktree.remove": shape(
    { repoId: stringValue, path: stringValue },
    {
      force: booleanValue,
      confirmed: booleanValue,
      confirmation: isConfirmationSubmission,
    },
  ),
  "worktree.open": repoPath,
  "review.list": shape(
    { repoId: stringValue },
    { providerId: stringValue, filters: reviewFilters },
  ),
  "review.open": reviewTarget,
  "review.submit": shape(
    {
      repoId: stringValue,
      providerId: stringValue,
      reviewId: stringValue,
      event: oneOf("APPROVE", "REQUEST_CHANGES", "COMMENT"),
    },
    { body: stringValue },
  ),
  "review.merge": shape(
    {
      repoId: stringValue,
      providerId: stringValue,
      reviewId: stringValue,
    },
    { method: oneOf("merge", "squash", "rebase") },
  ),
  "review.applySuggestion": shape({
    repoId: stringValue,
    providerId: stringValue,
    reviewId: stringValue,
    suggestionId: stringValue,
  }),
  "review.close": reviewTarget,
  "review.reopen": reviewTarget,
  "review.deleteSourceBranch": reviewTarget,
  "review.checkoutBranch": reviewTarget,
  "review.create": shape(
    {
      repoId: stringValue,
      providerId: stringValue,
      title: stringValue,
      sourceBranch: stringValue,
      targetBranch: stringValue,
    },
    { body: stringValue, draft: booleanValue },
  ),
  "review.createLineComment": shape(
    {
      repoId: stringValue,
      providerId: stringValue,
      reviewId: stringValue,
      path: stringValue,
      line: positiveInteger,
      body: stringValue,
    },
    { side: oneOf("LEFT", "RIGHT") },
  ),
  "diff.openInEditor": shape(
    {
      preview: shape(
        {
          relativePath: stringValue,
          title: stringValue,
          diff: (value: unknown) => isRecord(value),
        },
        { repoId: stringValue },
      ),
    },
    { workspaceRoot: stringValue },
  ),
} satisfies RequestValidatorMap;

export const WEBVIEW_REQUEST_TYPES = Object.freeze(
  Object.keys(requestValidators) as RequestType[],
);

export type WebviewRequestParseFailure = {
  ok: false;
  requestId: string | null;
  code: "INVALID_REQUEST" | "PROTOCOL_VERSION_UNSUPPORTED";
  message: string;
  details?: unknown;
};

export type WebviewRequestParseResult =
  | { ok: true; request: WebviewToHost | ExtensionWebviewRequest }
  | WebviewRequestParseFailure;

export function parseWebviewRequestResult(
  value: unknown,
  extensionValidators?: ReadonlyMap<string, ProtocolPayloadValidator>,
): WebviewRequestParseResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      requestId: null,
      code: "INVALID_REQUEST",
      message: "Protocol request must be an object.",
    };
  }

  const requestId =
    typeof value.requestId === "string" ? value.requestId : null;
  if (value.protocolVersion !== PROTOCOL_VERSION) {
    return {
      ok: false,
      requestId,
      code: "PROTOCOL_VERSION_UNSUPPORTED",
      message: `Unsupported protocol version. Expected ${PROTOCOL_VERSION}.`,
      details: { expected: PROTOCOL_VERSION, received: value.protocolVersion },
    };
  }
  if (!requestId || typeof value.type !== "string") {
    return {
      ok: false,
      requestId,
      code: "INVALID_REQUEST",
      message:
        "Protocol request requires non-empty requestId and type strings.",
    };
  }
  if (!Object.prototype.hasOwnProperty.call(requestValidators, value.type)) {
    const extensionValidator = extensionValidators?.get(value.type);
    if (
      extensionValidator &&
      isExtensionRequestType(value.type) &&
      extensionValidator(value.payload)
    ) {
      return { ok: true, request: value as ExtensionWebviewRequest };
    }
    return {
      ok: false,
      requestId,
      code: "INVALID_REQUEST",
      message: `Unknown protocol request type: ${value.type}`,
      details: { type: value.type },
    };
  }

  const type = value.type as RequestType;
  if (!requestValidators[type](value.payload)) {
    return {
      ok: false,
      requestId,
      code: "INVALID_REQUEST",
      message: `Invalid payload for protocol request: ${type}`,
      details: { type },
    };
  }
  return { ok: true, request: value as WebviewToHost };
}
