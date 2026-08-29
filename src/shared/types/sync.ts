export const SYNC_OPERATION_KINDS = [
  "fetch",
  "pull",
  "push",
  "update_all_roots",
] as const;

export type SyncOperationKind = (typeof SYNC_OPERATION_KINDS)[number];

export const SYNC_PHASES = [
  "preparing",
  "fetching",
  "pulling",
  "pushing",
  "refreshing",
  "reconciling",
] as const;

export type SyncPhase = (typeof SYNC_PHASES)[number];

export type SyncOutcome =
  | { kind: "success" }
  | { kind: "no_remote"; message: string }
  | {
      kind: "no_upstream";
      message: string;
      branch: string | null;
      remote: string | null;
    }
  | { kind: "auth_required"; message: string }
  | { kind: "offline"; message: string }
  | { kind: "certificate"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "conflicts"; message: string; paths: string[] }
  | { kind: "cancelled"; message: string }
  /**
   * The Git command itself succeeded but the follow-up refresh failed. The
   * repository is already in its post-command state, so this is never
   * retryable — retrying would run the same mutation a second time.
   */
  | { kind: "refresh_failed"; message: string; retryable: false }
  | { kind: "failed"; message: string; retryable: boolean };

export type SyncSuccessOutcome = Extract<SyncOutcome, { kind: "success" }>;
export type SyncCancelledOutcome = Extract<SyncOutcome, { kind: "cancelled" }>;
export type SyncFailureOutcome = Exclude<
  SyncOutcome,
  SyncSuccessOutcome | SyncCancelledOutcome
>;

type SyncRootStatusBase = {
  repoId: string;
  name: string;
};

export type SyncRootStatus =
  | (SyncRootStatusBase & { state: "pending" })
  | (SyncRootStatusBase & { state: "running"; phase: SyncPhase })
  | (SyncRootStatusBase & {
      state: "succeeded";
      outcome: SyncSuccessOutcome;
    })
  | (SyncRootStatusBase & {
      state: "failed";
      outcome: SyncFailureOutcome;
    })
  | (SyncRootStatusBase & {
      state: "cancelled";
      outcome: SyncCancelledOutcome;
    })
  | (SyncRootStatusBase & {
      state: "skipped";
      outcome: SyncFailureOutcome;
    });

export type SyncProgress = {
  completed: number;
  total: number;
  roots: SyncRootStatus[];
};

type SyncOperationEventBase = {
  operationId: string;
  requestId: string;
  operation: SyncOperationKind;
  repoIds: string[];
  sequence: number;
  timestamp: number;
};

export type SyncCancellationRejectionReason =
  | "not_found"
  | "not_cancellable"
  | "already_finished";

export type SyncOperationEvent =
  | (SyncOperationEventBase & {
      state: "accepted";
      phase: "preparing";
      cancellable: boolean;
    })
  | (SyncOperationEventBase & {
      state: "running";
      phase: SyncPhase;
      cancellable: boolean;
      progress?: SyncProgress;
    })
  | (SyncOperationEventBase & {
      state: "cancel_requested";
      phase: SyncPhase;
    })
  | (SyncOperationEventBase & {
      state: "cancel_confirmed";
      outcome: SyncCancelledOutcome;
      progress?: SyncProgress;
    })
  | (SyncOperationEventBase & {
      state: "cancel_rejected";
      phase: SyncPhase;
      reason: SyncCancellationRejectionReason;
      message: string;
      cancellable: boolean;
    })
  | (SyncOperationEventBase & {
      state: "completed";
      outcome: SyncSuccessOutcome;
      progress?: SyncProgress;
    })
  | (SyncOperationEventBase & {
      state: "failed";
      outcome: SyncFailureOutcome;
      progress?: SyncProgress;
    });

export type SyncCancelResult =
  | { operationId: string; accepted: true }
  | {
      operationId: string;
      accepted: false;
      reason: SyncCancellationRejectionReason;
      message: string;
    };

export function isSyncOperationActive(event: SyncOperationEvent): boolean {
  return !["cancel_confirmed", "completed", "failed"].includes(event.state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSyncOperationKind(value: unknown): value is SyncOperationKind {
  return (SYNC_OPERATION_KINDS as readonly unknown[]).includes(value);
}

function isSyncPhase(value: unknown): value is SyncPhase {
  return (SYNC_PHASES as readonly unknown[]).includes(value);
}

export function isSyncOutcome(value: unknown): value is SyncOutcome {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  switch (value.kind) {
    case "success":
      return true;
    case "no_remote":
    case "auth_required":
    case "offline":
    case "certificate":
    case "rejected":
    case "cancelled":
      return typeof value.message === "string";
    case "no_upstream":
      return (
        typeof value.message === "string" &&
        (typeof value.branch === "string" || value.branch === null) &&
        (typeof value.remote === "string" || value.remote === null)
      );
    case "conflicts":
      return typeof value.message === "string" && isStringArray(value.paths);
    case "refresh_failed":
      return typeof value.message === "string" && value.retryable === false;
    case "failed":
      return (
        typeof value.message === "string" && typeof value.retryable === "boolean"
      );
    default:
      return false;
  }
}

function isSyncFailureOutcome(value: unknown): value is SyncFailureOutcome {
  return (
    isSyncOutcome(value) && value.kind !== "success" && value.kind !== "cancelled"
  );
}

function isSyncRootStatus(value: unknown): value is SyncRootStatus {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.repoId) ||
    !isNonEmptyString(value.name)
  ) {
    return false;
  }
  switch (value.state) {
    case "pending":
      return true;
    case "running":
      return isSyncPhase(value.phase);
    case "succeeded":
      return isSyncOutcome(value.outcome) && value.outcome.kind === "success";
    case "failed":
    case "skipped":
      return isSyncFailureOutcome(value.outcome);
    case "cancelled":
      return isSyncOutcome(value.outcome) && value.outcome.kind === "cancelled";
    default:
      return false;
  }
}

function isSyncProgress(value: unknown): value is SyncProgress {
  if (!isRecord(value)) {
    return false;
  }
  const completed = value.completed;
  const total = value.total;
  return (
    typeof completed === "number" &&
    Number.isInteger(completed) &&
    completed >= 0 &&
    typeof total === "number" &&
    Number.isInteger(total) &&
    total >= completed &&
    Array.isArray(value.roots) &&
    value.roots.every(isSyncRootStatus)
  );
}

function hasValidOptionalProgress(value: Record<string, unknown>): boolean {
  return value.progress === undefined || isSyncProgress(value.progress);
}

export function isSyncOperationEvent(
  value: unknown,
): value is SyncOperationEvent {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.operationId) ||
    !isNonEmptyString(value.requestId) ||
    !isSyncOperationKind(value.operation) ||
    !isStringArray(value.repoIds) ||
    !value.repoIds.every(isNonEmptyString) ||
    typeof value.sequence !== "number" ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1 ||
    typeof value.timestamp !== "number" ||
    !Number.isFinite(value.timestamp) ||
    value.timestamp < 0
  ) {
    return false;
  }

  switch (value.state) {
    case "accepted":
      return value.phase === "preparing" && typeof value.cancellable === "boolean";
    case "running":
      return (
        isSyncPhase(value.phase) &&
        typeof value.cancellable === "boolean" &&
        hasValidOptionalProgress(value)
      );
    case "cancel_requested":
      return isSyncPhase(value.phase);
    case "cancel_confirmed":
      return (
        isSyncOutcome(value.outcome) &&
        value.outcome.kind === "cancelled" &&
        hasValidOptionalProgress(value)
      );
    case "cancel_rejected":
      return (
        isSyncPhase(value.phase) &&
        ["not_found", "not_cancellable", "already_finished"].includes(
          String(value.reason),
        ) &&
        typeof value.message === "string" &&
        typeof value.cancellable === "boolean"
      );
    case "completed":
      return (
        isSyncOutcome(value.outcome) &&
        value.outcome.kind === "success" &&
        hasValidOptionalProgress(value)
      );
    case "failed":
      return isSyncFailureOutcome(value.outcome) && hasValidOptionalProgress(value);
    default:
      return false;
  }
}

export function isSyncCancelResult(value: unknown): value is SyncCancelResult {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.operationId) ||
    typeof value.accepted !== "boolean"
  ) {
    return false;
  }
  if (value.accepted) {
    return true;
  }
  return (
    ["not_found", "not_cancellable", "already_finished"].includes(
      String(value.reason),
    ) && typeof value.message === "string"
  );
}
