import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
  rejectKeys: string[] = [],
): GitExecFn {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    if (rejectKeys.includes(key)) {
      return Promise.reject(new Error(`git failed: ${key}`));
    }
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
}

const verifyReject = [
  "rev-parse --verify MERGE_HEAD",
  "rev-parse --verify REBASE_HEAD",
  "rev-parse --verify CHERRY_PICK_HEAD",
  "rev-parse --verify REVERT_HEAD",
];

describe("messageRouter v1", () => {
  it("returns structured errors for unsupported versions and malformed payloads", async () => {
    const execGit: GitExecFn = async () => ({ stdout: "", stderr: "" });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => [],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [],
      postMessage: (message) => sent.push(message),
    });

    await router.handleRawMessage({
      protocolVersion: 99,
      requestId: "version-1",
      type: "repo.refresh",
      payload: {},
    });
    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "invalid-1",
      type: "changes.stage",
      payload: { repoId: "repo", paths: "bad" },
    });

    expect(sent).toEqual([
      expect.objectContaining({
        requestId: "version-1",
        error: expect.objectContaining({
          code: "PROTOCOL_VERSION_UNSUPPORTED",
        }),
      }),
      expect.objectContaining({
        requestId: "invalid-1",
        error: expect.objectContaining({ code: "INVALID_REQUEST" }),
      }),
    ]);
  });

  it("dispatches repository recovery actions to native workspace commands", async () => {
    const execGit: GitExecFn = async () => ({ stdout: "", stderr: "" });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => [],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const executeWorkspaceCommand = vi.fn(async () => undefined);
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [],
      executeWorkspaceCommand,
      postMessage: (message) => sent.push(message),
    });

    for (const [type, payload] of [
      ["workspace.openFolder", {}],
      ["workspace.clone", {}],
      ["workspace.manageTrust", {}],
      ["workspace.collapsePanel", {}],
      ["repository.addRemote", { repoId: "repo" }],
    ] as const) {
      await router.handleRawMessage({
        protocolVersion: PROTOCOL_VERSION,
        requestId: type,
        type,
        payload,
      });
    }

    expect(executeWorkspaceCommand.mock.calls).toEqual([
      ["openFolder"],
      ["clone"],
      ["manageTrust"],
      ["collapsePanel"],
      ["addRemote"],
    ]);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "workspace.openFolder", ok: true }),
        expect.objectContaining({ type: "workspace.clone", ok: true }),
        expect.objectContaining({ type: "workspace.manageTrust", ok: true }),
        expect.objectContaining({ type: "workspace.collapsePanel", ok: true }),
        expect.objectContaining({ type: "repository.addRemote", ok: true }),
      ]),
    );
  });

  it("handles repo.refresh and status.list", async () => {
    const execGit = makeExecGit(
      {
        "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
        "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
        "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
        "status --porcelain=v1 -z -b": {
          stdout: "## main\0 M file.ts\0",
          stderr: "",
        },
      },
      verifyReject,
    );

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService(["main"]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => {
        sent.push(msg);
      },
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "r1",
      type: "repo.refresh",
      payload: {},
    });

    const repoId = (
      sent.find(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type?: string }).type === "repo.snapshot",
      ) as { payload?: { repositories?: Array<{ id: string }> } }
    )?.payload?.repositories?.[0]?.id;

    expect(repoId).toBeDefined();
    expect(
      sent.find(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type?: string }).type === "status.snapshot" &&
          (m as { payload?: { repoId?: string } }).payload?.repoId === repoId,
      ),
    ).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ path: "file.ts" }),
          ]),
        }),
      }),
    );

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "r2",
      type: "status.list",
      payload: { repoId: repoId! },
    });

    const statusResponse = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "status.list" &&
        (m as { ok?: boolean }).ok === true,
    );
    expect(statusResponse).toBeDefined();
  });

  it("keeps every workspace root when refreshing a selected repository", async () => {
    const workspaceFolders = [
      { uriPath: "/workspace-one", name: "workspace-one" },
      { uriPath: "/workspace-two", name: "workspace-two" },
    ];
    const execGit: GitExecFn = async (repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: `${repoRoot}-sha\n`, stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return {
          stdout: `## ${repoRoot === "/workspace-one" ? "main" : "feature"}\0`,
          stderr: "",
        };
      }
      if (key === "remote") {
        return { stdout: "origin\n", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    };
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async (folderPath) => [folderPath],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => workspaceFolders,
      getTrusted: () => true,
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders,
      trusted: true,
    });
    const selectedRepoId = repos[1]!.id;
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders,
      postMessage: (message) => sent.push(message),
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "multi-root-refresh",
      type: "repo.refresh",
      payload: { repoId: selectedRepoId },
    });

    const snapshot = sent.find(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "repo.snapshot",
    ) as {
      payload: {
        repositories: Array<{ id: string }>;
        activeRepoId: string | null;
      };
    };
    expect(snapshot.payload.repositories.map((repo) => repo.id)).toEqual(
      expect.arrayContaining(repos.map((repo) => repo.id)),
    );
    expect(snapshot.payload.repositories).toHaveLength(2);
    expect(snapshot.payload.activeRepoId).toBe(selectedRepoId);
  });

  it("stages files after path validation and refreshes state", async () => {
    const execGit = makeExecGit(
      {
        "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
        "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
        "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
        "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
        "add -- src/app.ts": { stdout: "", stderr: "" },
      },
      verifyReject,
    );

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshListener = vi.fn();
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });
    refreshCoordinator.subscribe(refreshListener);

    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });
    const repoId = repos[0]!.id;

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "stage-1",
      type: "changes.stage",
      payload: { repoId, paths: ["src/app.ts"] },
    });

    const stageResponse = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "changes.stage",
    ) as { ok?: boolean; payload?: { staged?: string[] } };

    expect(stageResponse?.ok).toBe(true);
    expect(stageResponse?.payload?.staged).toEqual(["src/app.ts"]);
    expect(refreshListener).toHaveBeenCalled();
  });

  it("names the request when merge handlers are missing instead of a generic miss", async () => {
    const execGit: GitExecFn = async () => ({ stdout: "", stderr: "" });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => [],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [],
      postMessage: (message) => sent.push(message),
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "merge-1",
      type: "merge.openFile",
      payload: { repoId: "repo", path: "src/app.ts" },
    });

    expect(sent).toEqual([
      expect.objectContaining({
        requestId: "merge-1",
        ok: false,
        error: expect.objectContaining({
          code: "NOT_IMPLEMENTED",
          message: "Merge panel handlers are not configured for this surface.",
        }),
      }),
    ]);
  });

  it("rejects a repository mutation while a sync operation is active", async () => {
    const execGit: GitExecFn = async () => ({ stdout: "", stderr: "" });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => [],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      // A pull is in flight for `repo`. Staging must fail fast instead of
      // racing it.
      syncOperationCoordinator: {
        run: () => {
          throw new Error("not used");
        },
        cancel: () => ({
          operationId: "",
          accepted: false,
          reason: "not_found" as const,
          message: "",
        }),
        subscribe: () => () => undefined,
        hasActive: (repoId: string) => repoId === "repo",
        dispose: () => undefined,
      },
      trusted: true,
      workspaceFolders: [],
      postMessage: (message) => sent.push(message),
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "stage-during-sync",
      type: "changes.stage",
      payload: { repoId: "repo", paths: ["a.ts"] },
    });

    expect(sent).toEqual([
      expect.objectContaining({
        requestId: "stage-during-sync",
        error: expect.objectContaining({ code: "OPERATION_IN_PROGRESS" }),
      }),
    ]);
  });

  it("rejects git.menuAction while a sync operation is active", async () => {
    const execGit: GitExecFn = async () => ({ stdout: "", stderr: "" });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => [],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      // git.menuAction fans out to pull/push/checkout, so it must fail fast
      // while a sync is active like any other mutation.
      syncOperationCoordinator: {
        run: () => {
          throw new Error("not used");
        },
        cancel: () => ({
          operationId: "",
          accepted: false,
          reason: "not_found" as const,
          message: "",
        }),
        subscribe: () => () => undefined,
        hasActive: (repoId: string) => repoId === "repo",
        dispose: () => undefined,
      },
      trusted: true,
      workspaceFolders: [],
      postMessage: (message) => sent.push(message),
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "menu-during-sync",
      type: "git.menuAction",
      payload: { repoId: "repo", action: "pull" },
    });

    expect(sent).toEqual([
      expect.objectContaining({
        requestId: "menu-during-sync",
        error: expect.objectContaining({ code: "OPERATION_IN_PROGRESS" }),
      }),
    ]);
  });

  it("keeps read-only requests working while a sync operation is active", async () => {
    const execGit = makeExecGit(
      {
        "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
        "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
        "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
        "status --porcelain=v1 -z -b": {
          stdout: "## main\0 M file.ts\0",
          stderr: "",
        },
      },
      verifyReject,
    );
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      syncOperationCoordinator: {
        run: () => {
          throw new Error("not used");
        },
        cancel: () => ({
          operationId: "",
          accepted: false,
          reason: "not_found" as const,
          message: "",
        }),
        subscribe: () => () => undefined,
        hasActive: () => true,
        dispose: () => undefined,
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (message) => sent.push(message),
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "status-during-sync",
      type: "status.list",
      payload: { repoId: "repo" },
    });

    expect(
      sent.some(
        (message) =>
          (message as { error?: { code?: string } }).error?.code ===
          "OPERATION_IN_PROGRESS",
      ),
    ).toBe(false);
  });
});
