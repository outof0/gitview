import { describe, expect, it } from "vitest";
import {
  isSyncCancelResult,
  isSyncOperationActive,
  isSyncOperationEvent,
  isSyncOutcome,
  type SyncOperationEvent,
} from "../sync";

const base = {
  operationId: "sync-1",
  requestId: "request-1",
  operation: "update_all_roots",
  repoIds: ["repo-1"],
  sequence: 1,
  timestamp: 1,
} as const;

const progress = {
  completed: 4,
  total: 6,
  roots: [
    { repoId: "repo-1", name: "one", state: "pending" },
    { repoId: "repo-2", name: "two", state: "running", phase: "fetching" },
    {
      repoId: "repo-3",
      name: "three",
      state: "succeeded",
      outcome: { kind: "success" },
    },
    {
      repoId: "repo-4",
      name: "four",
      state: "failed",
      outcome: { kind: "offline", message: "offline" },
    },
    {
      repoId: "repo-5",
      name: "five",
      state: "skipped",
      outcome: { kind: "no_remote", message: "missing" },
    },
    {
      repoId: "repo-6",
      name: "six",
      state: "cancelled",
      outcome: { kind: "cancelled", message: "cancelled" },
    },
  ],
};

describe("sync runtime validation", () => {
  it("accepts every supported outcome and rejects malformed outcomes", () => {
    const valid = [
      { kind: "success" },
      { kind: "no_remote", message: "missing" },
      { kind: "auth_required", message: "login" },
      { kind: "offline", message: "offline" },
      { kind: "certificate", message: "certificate" },
      { kind: "rejected", message: "rejected" },
      { kind: "cancelled", message: "cancelled" },
      {
        kind: "no_upstream",
        message: "upstream",
        branch: null,
        remote: "origin",
      },
      { kind: "conflicts", message: "conflicts", paths: ["file.ts"] },
      { kind: "failed", message: "failed", retryable: true },
    ];
    for (const outcome of valid) {
      expect(isSyncOutcome(outcome)).toBe(true);
    }

    for (const outcome of [
      null,
      [],
      {},
      { kind: 1 },
      { kind: "unknown" },
      { kind: "offline", message: 1 },
      { kind: "no_upstream", message: "x", branch: 1, remote: null },
      { kind: "conflicts", message: "x", paths: [1] },
      { kind: "failed", message: "x", retryable: "yes" },
    ]) {
      expect(isSyncOutcome(outcome)).toBe(false);
    }
  });

  it("accepts every lifecycle state including multi-root progress", () => {
    const events: unknown[] = [
      { ...base, state: "accepted", phase: "preparing", cancellable: true },
      {
        ...base,
        state: "running",
        phase: "pulling",
        cancellable: true,
        progress,
      },
      { ...base, state: "cancel_requested", phase: "reconciling" },
      {
        ...base,
        state: "cancel_confirmed",
        outcome: { kind: "cancelled", message: "cancelled" },
        progress,
      },
      {
        ...base,
        state: "cancel_rejected",
        phase: "pushing",
        reason: "not_cancellable",
        message: "too late",
        cancellable: false,
      },
      { ...base, state: "completed", outcome: { kind: "success" }, progress },
      {
        ...base,
        state: "failed",
        outcome: { kind: "failed", message: "failed", retryable: false },
        progress,
      },
    ];

    for (const event of events) {
      expect(isSyncOperationEvent(event)).toBe(true);
    }
    expect(isSyncOperationActive(events[0] as SyncOperationEvent)).toBe(true);
    expect(isSyncOperationActive(events[3] as SyncOperationEvent)).toBe(false);
    expect(isSyncOperationActive(events[5] as SyncOperationEvent)).toBe(false);
    expect(isSyncOperationActive(events[6] as SyncOperationEvent)).toBe(false);
  });

  it("rejects malformed event identity and lifecycle state", () => {
    const accepted = {
      ...base,
      state: "accepted",
      phase: "preparing",
      cancellable: true,
    };
    for (const event of [
      null,
      [],
      { ...accepted, operationId: "" },
      { ...accepted, requestId: "" },
      { ...accepted, operation: "clone" },
      { ...accepted, repoIds: "repo-1" },
      { ...accepted, repoIds: [""] },
      { ...accepted, sequence: 0 },
      { ...accepted, sequence: 1.5 },
      { ...accepted, timestamp: -1 },
      { ...accepted, timestamp: Number.POSITIVE_INFINITY },
      { ...accepted, phase: "fetching" },
      { ...accepted, state: "unknown" },
    ]) {
      expect(isSyncOperationEvent(event)).toBe(false);
    }
  });

  it("rejects malformed progress and root states", () => {
    const running = {
      ...base,
      state: "running",
      phase: "fetching",
      cancellable: true,
    };
    for (const invalidProgress of [
      null,
      { ...progress, completed: -1 },
      { ...progress, completed: 1.5 },
      { ...progress, total: 2 },
      { ...progress, total: 6.5 },
      { ...progress, roots: null },
      { ...progress, roots: [{ repoId: "", name: "one", state: "pending" }] },
      { ...progress, roots: [{ repoId: "one", name: "", state: "pending" }] },
      {
        ...progress,
        roots: [{ repoId: "one", name: "one", state: "unknown" }],
      },
      {
        ...progress,
        roots: [{ repoId: "one", name: "one", state: "running", phase: "bad" }],
      },
      {
        ...progress,
        roots: [
          {
            repoId: "one",
            name: "one",
            state: "succeeded",
            outcome: { kind: "offline", message: "x" },
          },
        ],
      },
      {
        ...progress,
        roots: [
          {
            repoId: "one",
            name: "one",
            state: "failed",
            outcome: { kind: "success" },
          },
        ],
      },
      {
        ...progress,
        roots: [
          {
            repoId: "one",
            name: "one",
            state: "cancelled",
            outcome: { kind: "success" },
          },
        ],
      },
    ]) {
      expect(
        isSyncOperationEvent({ ...running, progress: invalidProgress }),
      ).toBe(false);
    }
  });

  it("rejects state-specific lifecycle payload errors", () => {
    for (const event of [
      { ...base, state: "running", phase: "bad", cancellable: true },
      { ...base, state: "running", phase: "fetching", cancellable: "yes" },
      { ...base, state: "cancel_requested", phase: "bad" },
      { ...base, state: "cancel_confirmed", outcome: { kind: "success" } },
      {
        ...base,
        state: "cancel_rejected",
        phase: "fetching",
        reason: "bad",
        message: "x",
        cancellable: false,
      },
      {
        ...base,
        state: "completed",
        outcome: { kind: "offline", message: "x" },
      },
      {
        ...base,
        state: "failed",
        outcome: { kind: "cancelled", message: "x" },
      },
    ]) {
      expect(isSyncOperationEvent(event)).toBe(false);
    }
  });

  it("validates cancellation results", () => {
    expect(isSyncCancelResult({ operationId: "sync-1", accepted: true })).toBe(
      true,
    );
    expect(
      isSyncCancelResult({
        operationId: "sync-1",
        accepted: false,
        reason: "already_finished",
        message: "finished",
      }),
    ).toBe(true);
    for (const result of [
      null,
      [],
      { operationId: "", accepted: true },
      { operationId: "sync-1", accepted: "yes" },
      { operationId: "sync-1", accepted: false, reason: "bad", message: "x" },
      {
        operationId: "sync-1",
        accepted: false,
        reason: "not_found",
        message: 1,
      },
    ]) {
      expect(isSyncCancelResult(result)).toBe(false);
    }
  });
});
