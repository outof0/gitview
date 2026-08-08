import { describe, expect, it } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import type { OperationState } from "../../shared/types/operation";

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

describe("messageRouter phase 3 handlers", () => {
  async function setupRouter(
    execGit: GitExecFn,
    operation: OperationState = { type: "none" },
  ) {
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
      detectOperation: async () => operation,
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
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });
    return { router, sent, repoId: repos[0]!.id };
  }

  it("merges a branch with options via branch.merge", async () => {
    const execGit = makeExecGit(
      {
        ...baseRepoResponses,
        "merge --no-ff feature": { stdout: "", stderr: "" },
      },
      operationVerifyReject,
    );
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "merge-1",
      type: "branch.merge",
      payload: { repoId, ref: "feature", noFf: true },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.merge",
    ) as { ok?: boolean; payload?: { ref: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ref).toBe("feature");
  });

  it("rebases onto a branch via branch.rebaseOnto", async () => {
    const execGit = makeExecGit(
      {
        ...baseRepoResponses,
        "rebase main": { stdout: "", stderr: "" },
      },
      operationVerifyReject,
    );
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "rebase-1",
      type: "branch.rebaseOnto",
      payload: { repoId, onto: "main" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.rebaseOnto",
    ) as { ok?: boolean; payload?: { onto: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.onto).toBe("main");
  });

  it("extracts changes from a commit via log.extractChanges", async () => {
    const execGit = makeExecGit(
      {
        ...baseRepoResponses,
        "cherry-pick -n deadbeef": { stdout: "", stderr: "" },
      },
      operationVerifyReject,
    );
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "extract-1",
      type: "log.extractChanges",
      payload: { repoId, sha: "deadbeef" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.extractChanges",
    ) as { ok?: boolean; payload?: { sha: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.sha).toBe("deadbeef");
  });

  it("aborts an in-progress rebase via operation.abort", async () => {
    const execGit = makeExecGit(
      {
        ...baseRepoResponses,
        "rev-parse --verify REBASE_HEAD": { stdout: "ref\n", stderr: "" },
        "rebase --abort": { stdout: "", stderr: "" },
      },
      [
        "rev-parse --verify MERGE_HEAD",
        "rev-parse --verify CHERRY_PICK_HEAD",
        "rev-parse --verify REVERT_HEAD",
      ],
    );
    const { router, sent, repoId } = await setupRouter(execGit, {
      type: "rebase",
      canContinue: true,
      canSkip: true,
      canAbort: true,
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "abort-1",
      type: "operation.abort",
      payload: { repoId },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "operation.abort",
    ) as { ok?: boolean; payload?: { ok: boolean } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ok).toBe(true);
  });

  it("skips a cherry-pick step via operation.skip", async () => {
    const execGit = makeExecGit(
      {
        ...baseRepoResponses,
        "rev-parse --verify CHERRY_PICK_HEAD": { stdout: "ref\n", stderr: "" },
        "cherry-pick --skip": { stdout: "", stderr: "" },
      },
      [
        "rev-parse --verify MERGE_HEAD",
        "rev-parse --verify REBASE_HEAD",
        "rev-parse --verify REVERT_HEAD",
      ],
    );
    const { router, sent, repoId } = await setupRouter(execGit, {
      type: "cherry_pick",
      canContinue: true,
      canSkip: true,
      canAbort: true,
    });

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "skip-1",
      type: "operation.skip",
      payload: { repoId },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "operation.skip",
    ) as { ok?: boolean };

    expect(response?.ok).toBe(true);
  });
});
