import { describe, expect, it, vi } from "vitest";
import { createProtectionService } from "../../services/protectionService";
import { createSyncOperationCoordinator } from "../../services/syncOperationCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { createHostEvent, type HostToWebview } from "../../shared/protocol";
import type { Repository } from "../../shared/types/repository";
import { createMutationHandlers } from "../handlers/mutations";

const repository: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: "abc",
  upstream: "origin/main",
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" },
  ahead: 0,
  behind: 0,
  conflictCount: 0,
  changeDigest: null,
  dirty: false,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

function createRepositoryService(repositories: Repository[] = [repository]) {
  return {
    discoverRepositories: vi.fn(async () => repositories),
    resolveRepositoryForResource: vi.fn(() => repositories[0]),
  } as never;
}

function setupWithExec(
  execGit: GitExecFn,
  repositories: Repository[] = [repository],
) {
  const sent: HostToWebview[] = [];
  const syncOperationCoordinator = createSyncOperationCoordinator({
    createOperationId: () => "sync-1",
  });
  syncOperationCoordinator.subscribe((event) =>
    sent.push(createHostEvent("sync.operation", event)),
  );
  const refreshNow = vi.fn(async () => undefined);
  const handlers = createMutationHandlers({
    execGit,
    repositoryService: createRepositoryService(repositories),
    protectionService: createProtectionService([]),
    refreshCoordinator: { refreshNow } as never,
    syncOperationCoordinator,
    trusted: true,
    workspaceFolders: repositories.map((repo) => ({
      uriPath: repo.workspaceFolderPath ?? repo.rootPath,
      name: repo.name,
    })),
    postMessage: (message) => sent.push(message),
  });
  return { handlers, sent, refreshNow, syncOperationCoordinator };
}

function setup(fetch: (signal: AbortSignal) => Promise<void>) {
  const execGit = vi.fn<GitExecFn>(async (_root, args, options) => {
    const command = args.join(" ");
    if (command === "remote") {
      return { stdout: "origin\n", stderr: "" };
    }
    if (
      command === "rev-parse --abbrev-ref --symbolic-full-name @{u}" ||
      command === "rev-parse --abbrev-ref @{u}"
    ) {
      return { stdout: "origin/main\n", stderr: "" };
    }
    if (command === "fetch origin" && options?.signal) {
      await fetch(options.signal);
      return { stdout: "", stderr: "" };
    }
    throw new Error(`Unexpected Git command: ${command}`);
  });
  return setupWithExec(execGit);
}

function gitError(
  message: string,
  streams: { stdout?: string; stderr?: string },
): Error {
  return Object.assign(new Error(message), streams);
}

function syncEvents(sent: HostToWebview[]) {
  return sent
    .filter(
      (
        message,
      ): message is Extract<HostToWebview, { type: "sync.operation" }> =>
        message.type === "sync.operation",
    )
    .map((message) => message.payload);
}

describe("sync mutation lifecycle", () => {
  it("passes AbortSignal to fetch and responds after refresh and completion", async () => {
    let release!: () => void;
    let receivedSignal: AbortSignal | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { handlers, sent, refreshNow } = setup(async (signal) => {
      receivedSignal = signal;
      await gate;
    });

    const running = handlers.fetchRepo("fetch-1", repository.id);
    await vi.waitFor(() => {
      expect(receivedSignal).not.toBeNull();
    });
    expect(
      sent.filter((message) => message.type === "sync.operation").map(
        (message) =>
          (message as Extract<HostToWebview, { type: "sync.operation" }>).payload
            .state,
      ),
    ).toEqual(["accepted", "running"]);

    release();
    await running;

    expect((receivedSignal as unknown as AbortSignal).aborted).toBe(false);
    expect(refreshNow).toHaveBeenCalledWith(repository.id);
    expect(sent.map((message) => message.type).slice(-2)).toEqual([
      "sync.operation",
      "sync.fetch",
    ]);
    expect(sent.at(-1)).toMatchObject({
      type: "sync.fetch",
      requestId: "fetch-1",
      ok: true,
    });
  });

  it("acknowledges cancellation before reporting confirmed abort", async () => {
    let receivedSignal: AbortSignal | null = null;
    const { handlers, sent } = setup(
      (signal) =>
        new Promise((_resolve, reject) => {
          receivedSignal = signal;
          signal.addEventListener(
            "abort",
            () => {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true },
          );
        }),
    );

    const running = handlers.fetchRepo("fetch-1", repository.id);
    await vi.waitFor(() => {
      expect(receivedSignal).not.toBeNull();
    });
    await handlers.cancelSync("cancel-1", "sync-1");
    await running;

    expect((receivedSignal as unknown as AbortSignal).aborted).toBe(true);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sync.cancel",
          requestId: "cancel-1",
          payload: { operationId: "sync-1", accepted: true },
        }),
        expect.objectContaining({
          type: "error",
          requestId: "fetch-1",
          error: expect.objectContaining({
            details: {
              outcome: expect.objectContaining({ kind: "cancelled" }),
            },
          }),
        }),
      ]),
    );
    const lifecycle = sent
      .filter((message) => message.type === "sync.operation")
      .map(
        (message) =>
          (message as Extract<HostToWebview, { type: "sync.operation" }>).payload,
      );
    expect(lifecycle.map((event) => event.state)).toEqual([
      "accepted",
      "running",
      "cancel_requested",
      "running",
      "cancel_confirmed",
    ]);
    expect(lifecycle[3]).toMatchObject({
      state: "running",
      phase: "reconciling",
      cancellable: false,
    });
  });

  it("reconciles repository truth before reporting a pull conflict", async () => {
    let receivedSignal: AbortSignal | undefined;
    const execGit = vi.fn<GitExecFn>(async (_root, args, options) => {
      const command = args.join(" ");
      if (command === "remote") {
        return { stdout: "origin\nteam\n", stderr: "" };
      }
      if (
        command === "rev-parse --abbrev-ref --symbolic-full-name @{u}" ||
        command === "rev-parse --abbrev-ref @{u}"
      ) {
        return { stdout: "team/main\n", stderr: "" };
      }
      if (command === "pull team --no-rebase") {
        receivedSignal = options?.signal;
        throw gitError("git pull failed", {
          stdout:
            "CONFLICT (content): Merge conflict in src/app.ts\nAutomatic merge failed; fix conflicts and then commit the result.\n",
        });
      }
      throw new Error(`Unexpected Git command: ${command}`);
    });
    const {
      handlers,
      sent,
      refreshNow,
      syncOperationCoordinator,
    } = setupWithExec(execGit);
    const timeline: string[] = [];
    refreshNow.mockImplementation(async () => {
      timeline.push("refresh");
    });
    syncOperationCoordinator.subscribe((event) => {
      timeline.push(`${event.state}:${"phase" in event ? event.phase : "terminal"}`);
    });

    await handlers.pullRepo("pull-1", repository.id, "merge");

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(refreshNow).toHaveBeenCalledWith(repository.id);
    const terminal = syncEvents(sent).at(-1);
    expect(terminal).toMatchObject({
      state: "failed",
      outcome: { kind: "conflicts" },
    });
    expect(timeline.indexOf("refresh")).toBeLessThan(
      timeline.findIndex((entry) => entry.startsWith("failed:")),
    );
    expect(sent.at(-1)).toMatchObject({
      type: "error",
      requestId: "pull-1",
      error: {
        code: "UNRESOLVED_CONFLICTS",
        details: { outcome: { kind: "conflicts" } },
      },
    });
  });

  it("rejects pull before acceptance when no remote is configured", async () => {
    const execGit = vi.fn<GitExecFn>(async (_root, args) => {
      if (args.join(" ") === "remote") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });
    const { handlers, sent, refreshNow } = setupWithExec(execGit);

    await handlers.pullRepo("pull-no-remote", repository.id);

    expect(syncEvents(sent)).toEqual([]);
    expect(refreshNow).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      type: "error",
      requestId: "pull-no-remote",
      error: { details: { outcome: { kind: "no_remote" } } },
    });
  });

  it("rejects pull before acceptance when the branch has no upstream", async () => {
    const execGit = vi.fn<GitExecFn>(async (_root, args) => {
      const command = args.join(" ");
      if (command === "remote") {
        return { stdout: "origin\n", stderr: "" };
      }
      throw new Error("No upstream configured");
    });
    const { handlers, sent, refreshNow } = setupWithExec(execGit);

    await handlers.pullRepo("pull-no-upstream", repository.id);

    expect(syncEvents(sent)).toEqual([]);
    expect(refreshNow).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      type: "error",
      requestId: "pull-no-upstream",
      error: {
        details: {
          outcome: {
            kind: "no_upstream",
            branch: repository.currentBranch,
            remote: "origin",
          },
        },
      },
    });
  });

  it.each([
    ["authentication", "Authentication failed for remote", "auth_required"],
    ["offline", "Could not resolve host: example.invalid", "offline"],
    [
      "certificate",
      "SSL certificate problem: unable to get local issuer certificate",
      "certificate",
    ],
  ])(
    "reports %s push failures without a successful response",
    async (_label, diagnostic, outcomeKind) => {
      let receivedSignal: AbortSignal | undefined;
      const execGit = vi.fn<GitExecFn>(async (_root, args, options) => {
        const command = args.join(" ");
        if (command === "remote") {
          return { stdout: "origin\n", stderr: "" };
        }
        if (
          command === "rev-parse --abbrev-ref --symbolic-full-name @{u}" ||
          command === "rev-parse --abbrev-ref @{u}"
        ) {
          return { stdout: "origin/main\n", stderr: "" };
        }
        if (command === "push origin main") {
          receivedSignal = options?.signal;
          throw gitError("git push failed", { stderr: diagnostic });
        }
        throw new Error(`Unexpected Git command: ${command}`);
      });
      const { handlers, sent, refreshNow } = setupWithExec(execGit);

      await handlers.pushRepo("push-1", repository.id);

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(refreshNow).toHaveBeenCalledWith(repository.id);
      expect(syncEvents(sent).at(-1)).toMatchObject({
        state: "failed",
        outcome: { kind: outcomeKind },
      });
      expect(
        sent.some((message) => message.type === "sync.push" && message.ok),
      ).toBe(false);
      expect(sent.at(-1)).toMatchObject({
        type: "error",
        requestId: "push-1",
        error: { details: { outcome: { kind: outcomeKind } } },
      });
    },
  );

  it("returns a rejected push response without reporting success", async () => {
    const execGit = vi.fn<GitExecFn>(async (_root, args) => {
      const command = args.join(" ");
      if (command === "remote") {
        return { stdout: "origin\n", stderr: "" };
      }
      if (
        command === "rev-parse --abbrev-ref --symbolic-full-name @{u}" ||
        command === "rev-parse --abbrev-ref @{u}"
      ) {
        return { stdout: "origin/main\n", stderr: "" };
      }
      if (command === "push origin main") {
        throw gitError("git push failed", {
          stderr: "Updates were rejected because the remote contains work.",
        });
      }
      throw new Error(`Unexpected Git command: ${command}`);
    });
    const { handlers, sent } = setupWithExec(execGit);

    await handlers.pushRepo("push-1", repository.id);

    expect(syncEvents(sent).at(-1)).toMatchObject({
      state: "failed",
      outcome: { kind: "rejected" },
    });
    expect(sent.at(-1)).toMatchObject({
      type: "sync.push",
      requestId: "push-1",
      ok: true,
      payload: {
        ok: false,
        rejected: true,
      },
    });
  });

  it("publishes per-root results for a partial update-all operation", async () => {
    const secondRepository: Repository = {
      ...repository,
      id: "repo-2",
      rootPath: "/repo-two",
      workspaceFolderPath: "/repo-two",
      gitDirPath: "/repo-two/.git",
      name: "repo-two",
      headSha: "def",
    };
    const execGit = vi.fn<GitExecFn>(async (root, args) => {
      const command = args.join(" ");
      if (command === "remote") {
        return { stdout: "origin\n", stderr: "" };
      }
      if (
        command === "rev-parse --abbrev-ref --symbolic-full-name @{u}" ||
        command === "rev-parse --abbrev-ref @{u}"
      ) {
        return { stdout: "origin/main\n", stderr: "" };
      }
      if (command === "fetch origin") {
        return { stdout: "", stderr: "" };
      }
      if (command === "pull origin --no-rebase" && root === "/repo") {
        return { stdout: "", stderr: "" };
      }
      if (command === "pull origin --no-rebase" && root === "/repo-two") {
        throw gitError("git pull failed", {
          stderr: "Could not resolve host: example.invalid",
        });
      }
      throw new Error(`Unexpected Git command: ${command}`);
    });
    const { handlers, sent, refreshNow } = setupWithExec(execGit, [
      repository,
      secondRepository,
    ]);

    await handlers.updateAllRoots("update-1", "merge");

    expect(refreshNow).toHaveBeenCalledWith(undefined);
    expect(syncEvents(sent).at(-1)).toMatchObject({
      state: "completed",
      outcome: { kind: "success" },
      progress: {
        completed: 2,
        total: 2,
        roots: [
          {
            repoId: repository.id,
            state: "succeeded",
            outcome: { kind: "success" },
          },
          {
            repoId: secondRepository.id,
            state: "failed",
            outcome: { kind: "offline" },
          },
        ],
      },
    });
    expect(sent.at(-1)).toMatchObject({
      type: "sync.updateAllRoots",
      requestId: "update-1",
      payload: {
        results: [
          { repoId: repository.id, ok: true },
          {
            repoId: secondRepository.id,
            ok: false,
            error: "git pull failed",
          },
        ],
      },
    });
  });

  it("reconciles and cancels every unfinished root in update-all", async () => {
    const secondRepository: Repository = {
      ...repository,
      id: "repo-2",
      rootPath: "/repo-two",
      workspaceFolderPath: "/repo-two",
      gitDirPath: "/repo-two/.git",
      name: "repo-two",
      headSha: "def",
    };
    let receivedSignal: AbortSignal | undefined;
    const fetchedRoots: string[] = [];
    const execGit = vi.fn<GitExecFn>(async (root, args, options) => {
      const command = args.join(" ");
      if (command === "remote") {
        return { stdout: "origin\n", stderr: "" };
      }
      if (
        command === "rev-parse --abbrev-ref --symbolic-full-name @{u}" ||
        command === "rev-parse --abbrev-ref @{u}"
      ) {
        return { stdout: "origin/main\n", stderr: "" };
      }
      if (command === "fetch origin") {
        fetchedRoots.push(root);
        receivedSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
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
      throw new Error(`Unexpected Git command: ${command}`);
    });
    const { handlers, sent, refreshNow } = setupWithExec(execGit, [
      repository,
      secondRepository,
    ]);

    const running = handlers.updateAllRoots("update-cancel", "merge");
    await vi.waitFor(() => expect(receivedSignal).toBeInstanceOf(AbortSignal));
    await handlers.cancelSync("cancel-update", "sync-1");
    await running;

    expect(receivedSignal?.aborted).toBe(true);
    expect(fetchedRoots).toEqual([repository.rootPath]);
    expect(refreshNow).toHaveBeenCalledWith(undefined);
    const lifecycle = syncEvents(sent);
    expect(lifecycle.map((event) => event.state)).toEqual([
      "accepted",
      "running",
      "running",
      "cancel_requested",
      "running",
      "cancel_confirmed",
    ]);
    expect(lifecycle.at(-2)).toMatchObject({
      state: "running",
      phase: "reconciling",
      cancellable: false,
    });
    expect(lifecycle.at(-1)).toMatchObject({
      state: "cancel_confirmed",
      progress: {
        completed: 2,
        roots: [
          { repoId: repository.id, state: "cancelled" },
          { repoId: secondRepository.id, state: "cancelled" },
        ],
      },
    });
    expect(sent.at(-1)).toMatchObject({
      type: "error",
      requestId: "update-cancel",
      error: { details: { outcome: { kind: "cancelled" } } },
    });
  });
});
