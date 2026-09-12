import { describe, expect, it, vi } from "vitest";
import {
  classifySyncFailure,
  createSyncOperationCoordinator,
} from "../syncOperationCoordinator";
import type { SyncOperationEvent } from "../../shared/types/sync";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function abortable(signal: AbortSignal): Promise<void> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      },
      { once: true },
    );
  });
}

const repository = { repoId: "repo-1", name: "repo" };

describe("syncOperationCoordinator", () => {
  it("publishes an ordered lifecycle and refreshes before completion", async () => {
    let timestamp = 100;
    const coordinator = createSyncOperationCoordinator({
      now: () => ++timestamp,
      createOperationId: () => "sync-1",
    });
    const events: SyncOperationEvent[] = [];
    coordinator.subscribe((event) => events.push(event));
    const order: string[] = [];

    const terminal = await coordinator.run({
      requestId: "fetch-1",
      operation: "fetch",
      repositories: [repository],
      phase: "fetching",
      execute: async () => {
        order.push("fetch");
      },
      refresh: async () => {
        order.push("refresh");
      },
    });
    order.push("response");

    expect(terminal.state).toBe("completed");
    expect(order).toEqual(["fetch", "refresh", "response"]);
    expect(events.map((event) => event.state)).toEqual([
      "accepted",
      "running",
      "running",
      "completed",
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(events[2]).toMatchObject({
      state: "running",
      phase: "refreshing",
      cancellable: false,
    });
  });

  it("prevents overlapping operations for the same repository", async () => {
    const gate = deferred();
    const coordinator = createSyncOperationCoordinator({
      createOperationId: () => "sync-locked",
    });
    const first = coordinator.run({
      requestId: "fetch-1",
      operation: "fetch",
      repositories: [repository],
      phase: "fetching",
      execute: async () => gate.promise,
      refresh: async () => undefined,
    });

    await expect(
      coordinator.run({
        requestId: "push-1",
        operation: "push",
        repositories: [repository],
        phase: "pushing",
        execute: async () => undefined,
        refresh: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "OPERATION_IN_PROGRESS" });

    gate.resolve();
    await first;
  });

  it("confirms cancellation only after the running command aborts", async () => {
    const coordinator = createSyncOperationCoordinator({
      createOperationId: () => "sync-cancel",
    });
    const events: SyncOperationEvent[] = [];
    coordinator.subscribe((event) => events.push(event));
    const receivedSignals: AbortSignal[] = [];
    const running = coordinator.run({
      requestId: "fetch-1",
      operation: "fetch",
      repositories: [repository],
      phase: "fetching",
      execute: async ({ signal }) => {
        receivedSignals.push(signal);
        await abortable(signal);
      },
      refresh: async () => undefined,
    });

    expect(coordinator.cancel("sync-cancel")).toEqual({
      operationId: "sync-cancel",
      accepted: true,
    });
    const terminal = await running;

    expect(receivedSignals[0]?.aborted).toBe(true);
    expect(terminal.state).toBe("cancel_confirmed");
    expect(events.map((event) => event.state)).toEqual([
      "accepted",
      "running",
      "cancel_requested",
      "cancel_confirmed",
    ]);
  });

  it("rejects cancellation during the non-cancellable refresh phase", async () => {
    const gate = deferred();
    const coordinator = createSyncOperationCoordinator({
      createOperationId: () => "sync-refresh",
    });
    const events: SyncOperationEvent[] = [];
    coordinator.subscribe((event) => events.push(event));
    const running = coordinator.run({
      requestId: "fetch-1",
      operation: "fetch",
      repositories: [repository],
      phase: "fetching",
      execute: async () => undefined,
      refresh: async () => gate.promise,
    });
    await vi.waitFor(() => {
      expect(events.at(-1)).toMatchObject({
        state: "running",
        phase: "refreshing",
      });
    });

    expect(coordinator.cancel("sync-refresh")).toMatchObject({
      accepted: false,
      reason: "not_cancellable",
    });
    expect(events.at(-1)).toMatchObject({
      state: "cancel_rejected",
      reason: "not_cancellable",
    });

    gate.resolve();
    await expect(running).resolves.toMatchObject({ state: "completed" });
  });

  it("replays the latest active and recent terminal states", async () => {
    const gate = deferred();
    const coordinator = createSyncOperationCoordinator({
      createOperationId: () => "sync-replay",
    });
    const running = coordinator.run({
      requestId: "fetch-1",
      operation: "fetch",
      repositories: [repository],
      phase: "fetching",
      execute: async () => gate.promise,
      refresh: async () => undefined,
    });
    const activeReplay: SyncOperationEvent[] = [];
    coordinator.subscribe((event) => activeReplay.push(event));
    expect(activeReplay).toHaveLength(1);
    expect(activeReplay[0]).toMatchObject({ state: "running" });

    gate.resolve();
    await running;
    const terminalReplay: SyncOperationEvent[] = [];
    coordinator.subscribe((event) => terminalReplay.push(event));
    expect(terminalReplay).toHaveLength(1);
    expect(terminalReplay[0]).toMatchObject({ state: "completed" });
  });

  it("classifies actionable network failures without exposing raw parsing to UI", () => {
    expect(classifySyncFailure(new Error("fatal: Authentication failed"))).toMatchObject(
      { kind: "auth_required" },
    );
    expect(
      classifySyncFailure(new Error("fatal: Could not resolve host: example.test")),
    ).toMatchObject({ kind: "offline" });
    expect(
      classifySyncFailure(new Error("fatal: SSL certificate problem: self-signed certificate")),
    ).toMatchObject({ kind: "certificate" });
  });

  it("reports hasActive only while an operation runs for the repository", async () => {
    const coordinator = createSyncOperationCoordinator({
      createOperationId: () => "sync-ha",
    });
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });

    const running = coordinator.run({
      requestId: "fetch-ha",
      operation: "fetch",
      repositories: [repository],
      phase: "fetching",
      execute: async () => {
        await gate;
      },
      refresh: async () => undefined,
    });

    expect(coordinator.hasActive("repo-1")).toBe(true);
    expect(coordinator.hasActive("repo-2")).toBe(false);
    release();
    await running;
    expect(coordinator.hasActive("repo-1")).toBe(false);
  });
});
