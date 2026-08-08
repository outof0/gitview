import { describe, expect, it } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import type { GitExecFn } from "../../services/git/types";
import { blamePorcelain } from "../../services/__tests__/gitService.testHelpers";

const baseRepoResponses = {
  "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
  "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
  "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
  "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
};

const operationVerifyReject = [
  "rev-parse --verify MERGE_HEAD",
  "rev-parse --verify REBASE_HEAD",
  "rev-parse --verify CHERRY_PICK_HEAD",
  "rev-parse --verify REVERT_HEAD",
];

describe("blame.query instance cache", () => {
  it("reuses blame results across routers in the same extension instance", async () => {
    let blameCalls = 0;
    const execGit: GitExecFn = (_repoRoot, args) => {
      const key = args.join(" ");
      if (operationVerifyReject.includes(key)) {
        return Promise.reject(new Error("missing"));
      }
      if (key === "diff --numstat -- src/app.ts") {
        return Promise.resolve({ stdout: "1\t0\tsrc/app.ts\n", stderr: "" });
      }
      if (key === "blame --line-porcelain -M -C HEAD -- src/app.ts") {
        blameCalls += 1;
        return Promise.resolve({ stdout: blamePorcelain, stderr: "" });
      }
      const resp = baseRepoResponses[key as keyof typeof baseRepoResponses];
      if (!resp) {
        throw new Error(`Unexpected git call: ${key}`);
      }
      return Promise.resolve(resp);
    };

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
    const routerDeps = {
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      blameCache: new Map(),
      postMessage: () => {},
    };

    const routerA = createMessageRouter(routerDeps);
    const routerB = createMessageRouter(routerDeps);
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });
    const repoId = repos[0]!.id;
    const request = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: "blame-1",
      type: "blame.query" as const,
      payload: { repoId, path: "src/app.ts", ref: "HEAD" },
    };

    await routerA.handleRawMessage({ ...request, requestId: "blame-a" });
    await routerB.handleRawMessage({ ...request, requestId: "blame-b" });

    expect(blameCalls).toBe(1);
  });
});
