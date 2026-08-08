import { describe, expect, it, vi } from "vitest";

vi.mock("../messageRouterDispatchRepo", () => ({
  dispatchRepo: vi.fn(async () => {
    throw new Error("dispatcher boom");
  }),
}));

import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";

const execGit: GitExecFn = () => Promise.resolve({ stdout: "", stderr: "" });

describe("messageRouter error boundary", () => {
  it("returns HostErrorResponse when a dispatcher throws", async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
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
      logger,
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [],
      postMessage: (msg) => sent.push(msg),
    });

    await expect(
      router.handleRawMessage({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "err-1",
        type: "repo.refresh",
        payload: {},
      }),
    ).resolves.toBeUndefined();

    const errorResponses = sent.filter(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false &&
        (m as { requestId?: string }).requestId === "err-1",
    );
    expect(errorResponses).toHaveLength(1);
    expect(errorResponses[0]).toMatchObject({
      requestId: "err-1",
      ok: false,
      error: {
        code: "GIT_COMMAND_FAILED",
        message: "dispatcher boom",
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      "protocol.request.failed",
      expect.objectContaining({
        requestId: "err-1",
        requestType: "repo.refresh",
        gitviewErrorCode: "GIT_COMMAND_FAILED",
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "protocol.request.completed",
      expect.objectContaining({ requestId: "err-1", outcome: "failed" }),
    );
  });
});
