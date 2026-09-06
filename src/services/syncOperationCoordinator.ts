import {
  classifyGitError,
} from "../shared/errors/classifyGitError";
import {
  createError,
  isGitViewStructuredError,
} from "../shared/errors/codes";
import type {
  SyncCancelResult,
  SyncCancelledOutcome,
  SyncFailureOutcome,
  SyncOperationEvent,
  SyncOperationKind,
  SyncPhase,
  SyncProgress,
  SyncRootStatus,
} from "../shared/types/sync";
import { NOOP_LOGGER, errorLogFields, type Logger } from "../observability/logger";
import { sanitizeLogMessage, toUserFacingGitError } from "../util/safeLog";

const RECENT_OPERATION_LIMIT = 20;
const RECENT_OPERATION_TTL_MS = 5 * 60_000;

type SyncRepositoryRef = {
  repoId: string;
  name: string;
};

type SyncExecutionContext = {
  signal: AbortSignal;
  report: (
    phase: SyncPhase,
    progress?: SyncProgress,
    cancellable?: boolean,
  ) => void;
};

export type RunSyncOperationOptions = {
  requestId: string;
  operation: SyncOperationKind;
  repositories: SyncRepositoryRef[];
  phase: SyncPhase;
  execute: (context: SyncExecutionContext) => Promise<void>;
  refresh: () => Promise<void>;
};

export type SyncTerminalEvent = Extract<
  SyncOperationEvent,
  { state: "completed" | "failed" | "cancel_confirmed" }
>;

export type SyncOperationListener = (event: SyncOperationEvent) => void;

type SyncOperationEventBaseKey =
  | "operationId"
  | "requestId"
  | "operation"
  | "repoIds"
  | "sequence"
  | "timestamp";

type WithoutSyncOperationEventBase<Event> = Event extends SyncOperationEvent
  ? Omit<Event, SyncOperationEventBaseKey>
  : never;

type SyncOperationEventDetail =
  WithoutSyncOperationEventBase<SyncOperationEvent>;

type ActiveOperation = {
  operationId: string;
  requestId: string;
  operation: SyncOperationKind;
  repositories: SyncRepositoryRef[];
  controller: AbortController;
  sequence: number;
  phase: SyncPhase;
  cancellable: boolean;
  cancelRequested: boolean;
  progress: SyncProgress;
};

export interface SyncOperationCoordinator {
  run(options: RunSyncOperationOptions): Promise<SyncTerminalEvent>;
  cancel(operationId: string): SyncCancelResult;
  subscribe(listener: SyncOperationListener): () => void;
  /** True while a synchronization operation is running for the repository. */
  hasActive(repoId: string): boolean;
  dispose(): void;
}

export type SyncOperationCoordinatorDeps = {
  logger?: Logger;
  now?: () => number;
  createOperationId?: () => string;
};

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const nodeError = error as Error & { code?: unknown };
  return error.name === "AbortError" || nodeError.code === "ABORT_ERR";
}

export function classifySyncFailure(error: unknown): SyncFailureOutcome {
  const structured = isGitViewStructuredError(error) ? error : null;
  const classification = structured ? null : classifyGitError(error);
  const code = structured?.code ?? classification?.code ?? "GIT_COMMAND_FAILED";
  // A structured error's message can itself carry raw Git stderr (for example
  // a PUSH_REJECTED built from push output), which may embed a credential-
  // bearing remote URL. Sanitize both paths — never surface either verbatim.
  const message =
    structured?.message
      ? sanitizeLogMessage(structured.message)
      : (toUserFacingGitError(error) ||
        "The Git synchronization operation failed.");
  switch (code) {
    case "AUTH_REQUIRED":
      return { kind: "auth_required", message };
    case "NETWORK_OFFLINE":
      return { kind: "offline", message };
    case "CERTIFICATE_ERROR":
      return { kind: "certificate", message };
    case "PUSH_REJECTED":
      return { kind: "rejected", message };
    case "UNRESOLVED_CONFLICTS":
      return { kind: "conflicts", message, paths: [] };
    default:
      return {
        kind: "failed",
        message,
        retryable: structured?.recoverable ?? !classification?.needsUserAction,
      };
  }
}

function runningProgress(
  repositories: SyncRepositoryRef[],
  phase: SyncPhase,
): SyncProgress {
  return {
    completed: 0,
    total: repositories.length,
    roots: repositories.map((repository) => ({
      ...repository,
      state: "running",
      phase,
    })),
  };
}

function refreshingProgress(progress: SyncProgress): SyncProgress {
  const roots = progress.roots.map((root): SyncRootStatus => {
    if (
      root.state === "succeeded" ||
      root.state === "failed" ||
      root.state === "cancelled" ||
      root.state === "skipped"
    ) {
      return root;
    }
    return {
      repoId: root.repoId,
      name: root.name,
      state: "running",
      phase: "refreshing",
    };
  });
  return {
    completed: roots.filter((root) => root.state !== "running").length,
    total: progress.total,
    roots,
  };
}

function terminalProgress(
  progress: SyncProgress,
  state: "succeeded" | "failed" | "cancelled",
  outcome:
    | { kind: "success" }
    | SyncFailureOutcome
    | SyncCancelledOutcome,
): SyncProgress {
  const roots = progress.roots.map((root): SyncRootStatus => {
    if (
      root.state === "succeeded" ||
      root.state === "failed" ||
      root.state === "cancelled" ||
      root.state === "skipped"
    ) {
      return root;
    }
    if (state === "succeeded" && outcome.kind === "success") {
      return { repoId: root.repoId, name: root.name, state, outcome };
    }
    if (state === "cancelled" && outcome.kind === "cancelled") {
      return { repoId: root.repoId, name: root.name, state, outcome };
    }
    return {
      repoId: root.repoId,
      name: root.name,
      state: "failed",
      outcome: outcome as SyncFailureOutcome,
    };
  });
  return {
    completed: roots.filter((root) => root.state !== "pending").length,
    total: progress.total,
    roots,
  };
}

export function createSyncOperationCoordinator(
  deps: SyncOperationCoordinatorDeps = {},
): SyncOperationCoordinator {
  const logger = deps.logger ?? NOOP_LOGGER;
  const now = deps.now ?? Date.now;
  let operationCounter = 0;
  const createOperationId =
    deps.createOperationId ??
    (() => `sync-${now().toString(36)}-${++operationCounter}`);
  const listeners = new Set<SyncOperationListener>();
  const activeById = new Map<string, ActiveOperation>();
  const activeByRepoId = new Map<string, string>();
  const latestById = new Map<string, SyncOperationEvent>();
  const recentTerminalIds: string[] = [];
  let disposed = false;

  function notify(event: SyncOperationEvent): void {
    if (disposed) {
      return;
    }
    latestById.set(event.operationId, event);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.warn("sync.operation.listenerFailed", errorLogFields(error));
      }
    }
  }

  function publish(
    active: ActiveOperation,
    detail: SyncOperationEventDetail,
  ): SyncOperationEvent {
    const event = {
      operationId: active.operationId,
      requestId: active.requestId,
      operation: active.operation,
      repoIds: active.repositories.map((repository) => repository.repoId),
      sequence: ++active.sequence,
      timestamp: now(),
      ...detail,
    } as SyncOperationEvent;
    notify(event);
    return event;
  }

  function release(active: ActiveOperation, terminal: SyncTerminalEvent): void {
    activeById.delete(active.operationId);
    for (const repository of active.repositories) {
      if (activeByRepoId.get(repository.repoId) === active.operationId) {
        activeByRepoId.delete(repository.repoId);
      }
    }
    if (disposed) {
      latestById.delete(active.operationId);
      return;
    }
    latestById.set(active.operationId, terminal);
    recentTerminalIds.push(active.operationId);
    const cutoff = now() - RECENT_OPERATION_TTL_MS;
    while (recentTerminalIds.length > 0) {
      const oldestId = recentTerminalIds[0];
      const oldest = oldestId ? latestById.get(oldestId) : undefined;
      if (
        recentTerminalIds.length <= RECENT_OPERATION_LIMIT &&
        oldest &&
        oldest.timestamp >= cutoff
      ) {
        break;
      }
      const removedId = recentTerminalIds.shift();
      if (removedId && !activeById.has(removedId)) {
        latestById.delete(removedId);
      }
    }
  }

  async function run(
    options: RunSyncOperationOptions,
  ): Promise<SyncTerminalEvent> {
    if (disposed) {
      throw createError(
        "OPERATION_IN_PROGRESS",
        "The synchronization coordinator has been disposed.",
      );
    }
    if (options.repositories.length === 0) {
      throw createError(
        "REPOSITORY_NOT_FOUND",
        "No repository is available for synchronization.",
      );
    }
    const conflictingRepo = options.repositories.find((repository) =>
      activeByRepoId.has(repository.repoId),
    );
    if (conflictingRepo) {
      throw createError(
        "OPERATION_IN_PROGRESS",
        `A synchronization operation is already running for ${conflictingRepo.name}.`,
      );
    }

    const active: ActiveOperation = {
      operationId: createOperationId(),
      requestId: options.requestId,
      operation: options.operation,
      repositories: options.repositories,
      controller: new AbortController(),
      sequence: 0,
      phase: options.phase,
      cancellable: true,
      cancelRequested: false,
      progress: runningProgress(options.repositories, options.phase),
    };
    activeById.set(active.operationId, active);
    for (const repository of active.repositories) {
      activeByRepoId.set(repository.repoId, active.operationId);
    }

    logger.info("sync.operation.accepted", {
      operationId: active.operationId,
      requestId: active.requestId,
      operation: active.operation,
      repoIds: active.repositories.map((repository) => repository.repoId),
    });
    publish(active, {
      state: "accepted",
      phase: "preparing",
      cancellable: true,
    });
    publish(active, {
      state: "running",
      phase: active.phase,
      cancellable: active.cancellable,
      progress: active.progress,
    });

    const finish = (event: SyncTerminalEvent): SyncTerminalEvent => {
      release(active, event);
      logger.info("sync.operation.completed", {
        operationId: active.operationId,
        requestId: active.requestId,
        operation: active.operation,
        state: event.state,
        outcome: event.outcome.kind,
      });
      return event;
    };

    try {
      await options.execute({
        signal: active.controller.signal,
        report: (phase, progress, cancellable = true) => {
          if (disposed || !activeById.has(active.operationId)) {
            return;
          }
          active.phase = phase;
          active.cancellable = cancellable;
          active.progress =
            progress ?? runningProgress(active.repositories, active.phase);
          publish(active, {
            state: "running",
            phase: active.phase,
            cancellable: active.cancellable,
            progress: active.progress,
          });
        },
      });

      if (active.cancelRequested) {
        active.cancellable = false;
        publish(active, {
          state: "cancel_rejected",
          phase: active.phase,
          reason: "already_finished",
          message: "The Git command finished before cancellation took effect.",
          cancellable: false,
        });
      }
    } catch (error) {
      if (active.cancelRequested && isAbortError(error)) {
        const outcome: SyncCancelledOutcome = {
          kind: "cancelled",
          message: "Synchronization was cancelled.",
        };
        active.progress = terminalProgress(
          active.progress,
          "cancelled",
          outcome,
        );
        return finish(
          publish(active, {
            state: "cancel_confirmed",
            outcome,
            progress: active.progress,
          }) as SyncTerminalEvent,
        );
      }
      const outcome = classifySyncFailure(error);
      active.progress = terminalProgress(active.progress, "failed", outcome);
      return finish(
        publish(active, {
          state: "failed",
          outcome,
          progress: active.progress,
        }) as SyncTerminalEvent,
      );
    }

    // The Git command has already succeeded. Refreshing is only bookkeeping, so
    // a failure here must not be reported as a retryable operation failure: the
    // repository is in its post-command state and a retry would run the same
    // mutation a second time — a second pull, a second push, and so on.
    active.phase = "refreshing";
    active.cancellable = false;
    active.progress = refreshingProgress(active.progress);
    publish(active, {
      state: "running",
      phase: "refreshing",
      cancellable: false,
      progress: active.progress,
    });

    try {
      await options.refresh();
    } catch (error) {
      const outcome = {
        kind: "refresh_failed",
        message: `The Git command completed, but refreshing the workspace failed (${
          error instanceof Error ? error.message : String(error)
        }). Refresh to see the current state.`,
        retryable: false,
      } as const;
      active.progress = terminalProgress(active.progress, "failed", outcome);
      return finish(
        publish(active, {
          state: "failed",
          outcome,
          progress: active.progress,
        }) as SyncTerminalEvent,
      );
    }

    const outcome = { kind: "success" } as const;
    active.progress = terminalProgress(active.progress, "succeeded", outcome);
    return finish(
      publish(active, {
        state: "completed",
        outcome,
        progress: active.progress,
      }) as SyncTerminalEvent,
    );
  }

  function cancel(operationId: string): SyncCancelResult {
    const active = activeById.get(operationId);
    if (!active) {
      const terminal = latestById.get(operationId);
      if (terminal) {
        return {
          operationId,
          accepted: false,
          reason: "already_finished",
          message: "The synchronization operation has already finished.",
        };
      }
      return {
        operationId,
        accepted: false,
        reason: "not_found",
        message: "The synchronization operation could not be found.",
      };
    }
    if (active.cancelRequested) {
      return { operationId, accepted: true };
    }
    if (!active.cancellable) {
      publish(active, {
        state: "cancel_rejected",
        phase: active.phase,
        reason: "not_cancellable",
        message: "The current synchronization phase cannot be cancelled safely.",
        cancellable: false,
      });
      return {
        operationId,
        accepted: false,
        reason: "not_cancellable",
        message: "The current synchronization phase cannot be cancelled safely.",
      };
    }

    active.cancelRequested = true;
    publish(active, {
      state: "cancel_requested",
      phase: active.phase,
    });
    active.controller.abort();
    return { operationId, accepted: true };
  }

  function subscribe(listener: SyncOperationListener): () => void {
    if (disposed) {
      return () => undefined;
    }
    listeners.add(listener);
    const replay = [...latestById.values()].sort(
      (left, right) =>
        left.timestamp - right.timestamp || left.sequence - right.sequence,
    );
    for (const event of replay) {
      try {
        listener(event);
      } catch (error) {
        logger.warn("sync.operation.listenerFailed", errorLogFields(error));
      }
    }
    return () => listeners.delete(listener);
  }

  function hasActive(repoId: string): boolean {
    return activeByRepoId.has(repoId);
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    listeners.clear();
    for (const active of activeById.values()) {
      active.cancelRequested = true;
      active.controller.abort();
    }
    activeById.clear();
    activeByRepoId.clear();
    latestById.clear();
    recentTerminalIds.length = 0;
  }

  return { run, cancel, subscribe, hasActive, dispose };
}
