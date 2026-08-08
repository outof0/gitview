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
});
