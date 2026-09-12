import type { DiffLineSelection } from "./diff";
import type { OperationState } from "./operation";

export type RepositoryStateFingerprint = {
  headSha: string | null;
  currentBranch: string | null;
  dirty: boolean;
  conflictCount: number;
  operation: OperationState["type"];
  /**
   * Content digest of the pending working-tree changes at the time the evidence
   * was issued (null when the tree was clean). Without it the fingerprint only
   * recorded `dirty: boolean`, so editing a dirty file into different content
   * still produced a "valid" confirmation — a hard reset, force checkout,
   * rollback or worktree removal could then destroy edits the user never agreed
   * to lose. See `computeChangeDigest` in `src/services/git/changeDigest.ts`.
   */
  changeDigest: string | null;
};

export type HardResetConfirmationEvidence = {
  version: 1;
  action: "hard_reset";
  repoId: string;
  targetSha: string;
  resetMode: "hard";
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

export type DropCommitConfirmationEvidence = {
  version: 1;
  action: "drop_commit";
  repoId: string;
  targetSha: string;
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

export type SelectedChangesConfirmationSelection = {
  hunkIndexes: number[];
  lines: DiffLineSelection[];
};

export type DropSelectedConfirmationEvidence = {
  version: 1;
  action: "drop_selected";
  repoId: string;
  targetSha: string;
  path: string;
  selection: SelectedChangesConfirmationSelection;
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

export type RollbackConfirmationEvidence = {
  version: 1;
  action: "rollback";
  repoId: string;
  paths: string[];
  unversionedPaths: string[];
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

export type ForceCheckoutConfirmationEvidence = {
  version: 1;
  action: "force_checkout";
  repoId: string;
  targetRef: string;
  targetSha: string;
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

type MultiRootForceCheckoutTargetEvidence = {
  repoId: string;
  targetSha: string;
  repository: RepositoryStateFingerprint;
};

export type MultiRootForceCheckoutConfirmationEvidence = {
  version: 1;
  action: "force_checkout_multi";
  repoId: string;
  targetRef: string;
  targets: MultiRootForceCheckoutTargetEvidence[];
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

export type WorktreeRemovalTargetFingerprint = {
  path: string;
  headSha: string | null;
  branch: string | null;
  dirty: boolean;
};

export type RemoveDirtyWorktreeConfirmationEvidence = {
  version: 1;
  action: "remove_dirty_worktree";
  repoId: string;
  target: WorktreeRemovalTargetFingerprint;
  expectedTypedValue: string;
  repository: RepositoryStateFingerprint;
};

export type ConfirmationEvidence =
  | HardResetConfirmationEvidence
  | DropCommitConfirmationEvidence
  | DropSelectedConfirmationEvidence
  | RollbackConfirmationEvidence
  | ForceCheckoutConfirmationEvidence
  | MultiRootForceCheckoutConfirmationEvidence
  | RemoveDirtyWorktreeConfirmationEvidence;

export type ConfirmationSubmission = {
  evidence: ConfirmationEvidence;
  typedValue: string;
};

export type ConfirmationRepositoryState = {
  id: string;
  headSha: string | null;
  currentBranch: string | null;
  dirty: boolean;
  conflictCount: number;
  operation: OperationState;
  changeDigest: string | null;
};

export function fingerprintRepository(
  repository: ConfirmationRepositoryState,
): RepositoryStateFingerprint {
  return {
    headSha: repository.headSha,
    currentBranch: repository.currentBranch,
    dirty: repository.dirty,
    conflictCount: repository.conflictCount,
    operation: repository.operation.type,
    changeDigest: repository.changeDigest,
  };
}

export function createHardResetConfirmationEvidence(
  repository: ConfirmationRepositoryState,
  targetSha: string,
): HardResetConfirmationEvidence {
  return {
    version: 1,
    action: "hard_reset",
    repoId: repository.id,
    targetSha,
    resetMode: "hard",
    expectedTypedValue:
      repository.currentBranch ?? repository.headSha ?? targetSha,
    repository: fingerprintRepository(repository),
  };
}

export function createDropCommitConfirmationEvidence(
  repository: ConfirmationRepositoryState,
  targetSha: string,
): DropCommitConfirmationEvidence {
  return {
    version: 1,
    action: "drop_commit",
    repoId: repository.id,
    targetSha,
    expectedTypedValue: targetSha.slice(0, 7),
    repository: fingerprintRepository(repository),
  };
}

export function createDropSelectedConfirmationEvidence(
  repository: ConfirmationRepositoryState,
  targetSha: string,
  path: string,
  selection: {
    hunkIndexes?: number[];
    lines?: DiffLineSelection[];
  },
): DropSelectedConfirmationEvidence {
  return {
    version: 1,
    action: "drop_selected",
    repoId: repository.id,
    targetSha,
    path,
    selection: {
      hunkIndexes: selection.hunkIndexes ?? [],
      lines: selection.lines ?? [],
    },
    expectedTypedValue: targetSha.slice(0, 7),
    repository: fingerprintRepository(repository),
  };
}

export function createRollbackConfirmationEvidence(
  repository: ConfirmationRepositoryState,
  paths: string[],
  unversionedPaths: string[],
): RollbackConfirmationEvidence {
  return {
    version: 1,
    action: "rollback",
    repoId: repository.id,
    paths: [...paths],
    unversionedPaths: [...unversionedPaths],
    expectedTypedValue: unversionedPaths.length > 0 ? "DELETE" : "ROLLBACK",
    repository: fingerprintRepository(repository),
  };
}

export function createForceCheckoutConfirmationEvidence(
  repository: ConfirmationRepositoryState,
  targetRef: string,
  targetSha: string,
): ForceCheckoutConfirmationEvidence {
  return {
    version: 1,
    action: "force_checkout",
    repoId: repository.id,
    targetRef,
    targetSha,
    expectedTypedValue: targetRef,
    repository: fingerprintRepository(repository),
  };
}

export function createMultiRootForceCheckoutConfirmationEvidence(
  initiatingRepository: ConfirmationRepositoryState,
  targetRef: string,
  targets: Array<{
    repository: ConfirmationRepositoryState;
    targetSha: string;
  }>,
): MultiRootForceCheckoutConfirmationEvidence {
  return {
    version: 1,
    action: "force_checkout_multi",
    repoId: initiatingRepository.id,
    targetRef,
    targets: targets
      .map(({ repository, targetSha }) => ({
        repoId: repository.id,
        targetSha,
        repository: fingerprintRepository(repository),
      }))
      .sort((left, right) => left.repoId.localeCompare(right.repoId)),
    expectedTypedValue: targetRef,
    repository: fingerprintRepository(initiatingRepository),
  };
}

export function createRemoveDirtyWorktreeConfirmationEvidence(
  repository: ConfirmationRepositoryState,
  target: WorktreeRemovalTargetFingerprint,
): RemoveDirtyWorktreeConfirmationEvidence {
  return {
    version: 1,
    action: "remove_dirty_worktree",
    repoId: repository.id,
    target: { ...target },
    expectedTypedValue: target.path,
    repository: fingerprintRepository(repository),
  };
}

export function matchesWorktreeRemovalTarget(
  target: WorktreeRemovalTargetFingerprint,
  fingerprint: WorktreeRemovalTargetFingerprint,
): boolean {
  return (
    target.path === fingerprint.path &&
    target.headSha === fingerprint.headSha &&
    target.branch === fingerprint.branch &&
    target.dirty === fingerprint.dirty
  );
}

export function matchesSelectedChangesConfirmationSelection(
  selection: { hunkIndexes?: number[]; lines?: DiffLineSelection[] },
  evidence: SelectedChangesConfirmationSelection,
): boolean {
  return (
    JSON.stringify(selection.hunkIndexes ?? []) ===
      JSON.stringify(evidence.hunkIndexes) &&
    JSON.stringify(selection.lines ?? []) === JSON.stringify(evidence.lines)
  );
}

export function matchesRollbackConfirmationPaths(
  paths: string[],
  unversionedPaths: string[],
  evidence: Pick<RollbackConfirmationEvidence, "paths" | "unversionedPaths">,
): boolean {
  return (
    JSON.stringify(paths) === JSON.stringify(evidence.paths) &&
    JSON.stringify(unversionedPaths) ===
      JSON.stringify(evidence.unversionedPaths)
  );
}

export function matchesRepositoryFingerprint(
  repository: ConfirmationRepositoryState,
  fingerprint: RepositoryStateFingerprint,
): boolean {
  const current = fingerprintRepository(repository);
  return (
    current.headSha === fingerprint.headSha &&
    current.currentBranch === fingerprint.currentBranch &&
    current.dirty === fingerprint.dirty &&
    current.conflictCount === fingerprint.conflictCount &&
    current.operation === fingerprint.operation &&
    current.changeDigest === fingerprint.changeDigest
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === expected.size &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isDiffLineSelection(value: unknown): value is DiffLineSelection {
  if (!isRecord(value) || !hasExactKeys(value, ["side", "line"])) {
    return false;
  }
  return (
    (value.side === "old" || value.side === "new") &&
    typeof value.line === "number" &&
    Number.isInteger(value.line) &&
    value.line > 0
  );
}

function isSelectedChangesConfirmationSelection(
  value: unknown,
): value is SelectedChangesConfirmationSelection {
  if (!isRecord(value) || !hasExactKeys(value, ["hunkIndexes", "lines"])) {
    return false;
  }
  if (!Array.isArray(value.hunkIndexes) || !Array.isArray(value.lines)) {
    return false;
  }
  const validHunks = value.hunkIndexes.every(
    (index) => typeof index === "number" && Number.isInteger(index) && index >= 0,
  );
  const validLines = value.lines.every(isDiffLineSelection);
  return validHunks && validLines && (value.hunkIndexes.length > 0 || value.lines.length > 0);
}

function isRepositoryStateFingerprint(
  value: unknown,
): value is RepositoryStateFingerprint {
  if (!isRecord(value)) {
    return false;
  }
  return (
    hasExactKeys(value, [
      "headSha",
      "currentBranch",
      "dirty",
      "conflictCount",
      "operation",
      "changeDigest",
    ]) &&
    isNullableString(value.headSha) &&
    isNullableString(value.currentBranch) &&
    isNullableString(value.changeDigest) &&
    typeof value.dirty === "boolean" &&
    typeof value.conflictCount === "number" &&
    Number.isInteger(value.conflictCount) &&
    value.conflictCount >= 0 &&
    [
      "none",
      "merge",
      "rebase",
      "cherry_pick",
      "revert",
      "bisect",
    ].includes(String(value.operation))
  );
}

export function isConfirmationEvidence(
  value: unknown,
): value is ConfirmationEvidence {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.repoId !== "string" ||
    value.repoId.length === 0 ||
    typeof value.expectedTypedValue !== "string" ||
    value.expectedTypedValue.length === 0 ||
    !isRepositoryStateFingerprint(value.repository)
  ) {
    return false;
  }

  const hasTargetSha =
    typeof value.targetSha === "string" && value.targetSha.length > 0;

  if (value.action === "hard_reset") {
    return (
      hasTargetSha &&
      hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "targetSha",
        "resetMode",
        "expectedTypedValue",
        "repository",
      ]) &&
      value.resetMode === "hard"
    );
  }

  if (value.action === "drop_commit") {
    return (
      hasTargetSha &&
      hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "targetSha",
        "expectedTypedValue",
        "repository",
      ])
    );
  }

  if (value.action === "drop_selected") {
    return (
      hasTargetSha &&
      hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "targetSha",
        "path",
        "selection",
        "expectedTypedValue",
        "repository",
      ]) &&
      typeof value.path === "string" &&
      value.path.length > 0 &&
      isSelectedChangesConfirmationSelection(value.selection)
    );
  }

  if (value.action === "rollback") {
    if (
      !hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "paths",
        "unversionedPaths",
        "expectedTypedValue",
        "repository",
      ]) ||
      !Array.isArray(value.paths) ||
      value.paths.length === 0 ||
      !Array.isArray(value.unversionedPaths)
    ) {
      return false;
    }
    const paths = value.paths;
    const unversionedPaths = value.unversionedPaths;
    return (
      paths.every((path) => typeof path === "string" && path.length > 0) &&
      unversionedPaths.every(
        (path) => typeof path === "string" && path.length > 0,
      ) &&
      unversionedPaths.every((path) => paths.includes(path))
    );
  }

  if (value.action === "force_checkout") {
    return (
      hasTargetSha &&
      hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "targetRef",
        "targetSha",
        "expectedTypedValue",
        "repository",
      ]) &&
      typeof value.targetRef === "string" &&
      value.targetRef.length > 0
    );
  }

  if (value.action === "force_checkout_multi") {
    if (
      !hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "targetRef",
        "targets",
        "expectedTypedValue",
        "repository",
      ]) ||
      typeof value.targetRef !== "string" ||
      value.targetRef.length === 0 ||
      !Array.isArray(value.targets) ||
      value.targets.length === 0
    ) {
      return false;
    }
    const targets = value.targets;
    const validTargets = targets.every(
      (target) =>
        isRecord(target) &&
        hasExactKeys(target, ["repoId", "targetSha", "repository"]) &&
        typeof target.repoId === "string" &&
        target.repoId.length > 0 &&
        typeof target.targetSha === "string" &&
        target.targetSha.length > 0 &&
        isRepositoryStateFingerprint(target.repository),
    );
    return (
      validTargets &&
      new Set(
        targets.map((target) =>
          isRecord(target) && typeof target.repoId === "string"
            ? target.repoId
            : "",
        ),
      ).size === targets.length
    );
  }

  if (value.action === "remove_dirty_worktree") {
    const target = value.target;
    return (
      hasExactKeys(value, [
        "version",
        "action",
        "repoId",
        "target",
        "expectedTypedValue",
        "repository",
      ]) &&
      isRecord(target) &&
      hasExactKeys(target, ["path", "headSha", "branch", "dirty"]) &&
      typeof target.path === "string" &&
      target.path.length > 0 &&
      isNullableString(target.headSha) &&
      isNullableString(target.branch) &&
      typeof target.dirty === "boolean"
    );
  }

  return false;
}

export function isConfirmationSubmission(
  value: unknown,
): value is ConfirmationSubmission {
  if (!isRecord(value)) {
    return false;
  }
  return (
    hasExactKeys(value, ["evidence", "typedValue"]) &&
    isConfirmationEvidence(value.evidence) &&
    typeof value.typedValue === "string"
  );
}
