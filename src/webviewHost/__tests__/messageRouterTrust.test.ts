import { describe, expect, it, vi } from "vitest";
import {
  isWorkspaceTrusted,
  withLiveTrustedField,
} from "../messageRouterTrust";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";

describe("messageRouterTrust", () => {
  it("prefers getTrusted over the snapshot flag", () => {
    expect(
      isWorkspaceTrusted({
        trusted: false,
        getTrusted: () => true,
      }),
    ).toBe(true);
    expect(
      isWorkspaceTrusted({
        trusted: true,
        getTrusted: () => false,
      }),
    ).toBe(false);
  });

  it("withLiveTrustedField re-reads trust after grant", () => {
    let trusted = false;
    const live = withLiveTrustedField(
      { label: "router" as const },
      { getTrusted: () => trusted },
    );
    expect(live.trusted).toBe(false);
    trusted = true;
    expect(live.trusted).toBe(true);
  });

  it("withLiveTrustedField re-reads workspace roots", () => {
    let folders = [{ uriPath: "/one", name: "one" }];
    const live = withLiveTrustedField(
      { workspaceFolders: folders },
      { getWorkspaceFolders: () => folders },
    );
    expect(live.workspaceFolders[0]?.uriPath).toBe("/one");
    folders = [{ uriPath: "/two", name: "two" }];
    expect(live.workspaceFolders[0]?.uriPath).toBe("/two");
  });

  it("message router mutations see live trust after grant", async () => {
    let trusted = false;
    const execGit: GitExecFn = async (_root, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --show-toplevel") {
        return { stdout: "/repo\n", stderr: "" };
      }
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: "abc\n", stderr: "" };
      }
      if (key.startsWith("rev-parse --verify")) {
        return Promise.reject(new Error("missing"));
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0", stderr: "" };
      }
      if (key.startsWith("add --")) {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    };

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => trusted,
    });
    vi.spyOn(refreshCoordinator, "refreshNow").mockResolvedValue({
      repoSnapshot: {
        repositories: [],
        activeRepoId: null,
        multiRootDiverged: false,
      },
      statusByRepoId: new Map(),
      traceId: "test",
    });

    const sent: unknown[] = [];
    const router = createMessageRouter({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: false,
      getTrusted: () => trusted,
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
      payload: { repoId, paths: ["file.ts"] },
    });

    const deniedBefore = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };
    expect(deniedBefore?.error?.code).toBe("WORKSPACE_UNTRUSTED");

    trusted = true;
    sent.length = 0;

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "stage-2",
      type: "changes.stage",
      payload: { repoId, paths: ["file.ts"] },
    });

    const deniedAfter = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false &&
        (m as { error?: { code?: string } }).error?.code ===
          "WORKSPACE_UNTRUSTED",
    );
    expect(deniedAfter).toBeUndefined();
    expect(
      sent.some(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type?: string }).type === "changes.stage" &&
          (m as { ok?: boolean }).ok === true,
      ),
    ).toBe(true);
  });
});
