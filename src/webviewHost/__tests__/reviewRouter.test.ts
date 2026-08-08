import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import type { ReviewFetch } from "../../services/review/reviewFetch";

const verifyReject = [
  "rev-parse --verify MERGE_HEAD",
  "rev-parse --verify REBASE_HEAD",
  "rev-parse --verify CHERRY_PICK_HEAD",
  "rev-parse --verify REVERT_HEAD",
];

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
): GitExecFn {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    if (verifyReject.includes(key)) {
      return Promise.reject(new Error("missing"));
    }
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
}

function pullPayload(
  number: number,
  state: "open" | "closed",
  merged = false,
) {
  return {
    id: number,
    number,
    title: `PR ${number}`,
    state,
    merged_at: merged ? "2026-01-02T00:00:00Z" : null,
    merged,
    mergeable_state: state === "open" ? "clean" : undefined,
    user: { login: "dev" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    head: { ref: "feature", sha: "abc123def", repo: { full_name: "acme/app" } },
    base: { ref: "main", repo: { full_name: "acme/app" } },
  };
}

function githubFetchMock(): ReviewFetch {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const pullNum = url.match(/\/pulls\/(\d+)/)?.[1];
    const issueNum = url.match(/\/issues\/(\d+)/)?.[1];
    const num = pullNum
      ? Number.parseInt(pullNum, 10)
      : issueNum
        ? Number.parseInt(issueNum, 10)
        : 0;

    if (init?.method === "PATCH" && pullNum) {
      return new Response("{}", { status: 200 });
    }
    if (init?.method === "POST" && url.endsWith("/pulls")) {
      return new Response(
        JSON.stringify({
          ...pullPayload(21, "open"),
          number: 21,
          title: "New PR",
        }),
        { status: 201 },
      );
    }
    if (
      init?.method === "POST" &&
      pullNum &&
      url.includes(`/pulls/${pullNum}/comments`)
    ) {
      return new Response(JSON.stringify({ id: 501 }), { status: 201 });
    }
    if (url.includes("/git/refs/heads/feature") && init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (pullNum && url.includes(`/pulls/${pullNum}/files`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (pullNum && url.includes(`/pulls/${pullNum}/commits`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (issueNum && url.includes(`/issues/${issueNum}/comments`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (pullNum && url.includes(`/pulls/${pullNum}/reviews`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (pullNum && url.includes(`/pulls/${pullNum}/comments`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (
      pullNum &&
      (url.endsWith(`/pulls/${pullNum}`) || url.includes(`/pulls/${pullNum}?`))
    ) {
      const parsed = Number.parseInt(pullNum, 10);
      const merged = parsed === 8;
      return new Response(
        JSON.stringify(
          pullPayload(parsed, merged ? "closed" : "open", merged),
        ),
        { status: 200 },
      );
    }
    void num;
    return new Response("not found", { status: 404 });
  }) as ReviewFetch;
}

describe("messageRouter review lifecycle handlers", () => {
  const baseResponses = {
    "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
    "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
    "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
    "remote get-url origin": { stdout: "https://github.com/acme/app.git\n", stderr: "" },
    "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
    "fetch origin refs/pull/7/head:review/pr-7": { stdout: "", stderr: "" },
    "switch review/pr-7": { stdout: "", stderr: "" },
  };

  async function setupRouter(extra: Record<string, { stdout: string; stderr: string }> = {}) {
    const execGit = makeExecGit({ ...baseResponses, ...extra });
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
    const refreshNow = vi.spyOn(refreshCoordinator, "refreshNow").mockResolvedValue({
      repoSnapshot: { repositories: [], activeRepoId: null, multiRootDiverged: false },
      statusByRepoId: new Map(),
      traceId: "test",
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
      getReviewAccessToken: async () => "token",
      reviewFetchFn: githubFetchMock(),
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });
    return { router, sent, repoId: repos[0]!.id, refreshNow };
  }

  it("closes a review via review.close", async () => {
    const { router, sent, repoId } = await setupRouter();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "close-1",
      type: "review.close",
      payload: { repoId, providerId: "github", reviewId: "7" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.close",
    ) as { ok?: boolean };
    expect(response?.ok).toBe(true);
  });

  it("reopens a review via review.reopen", async () => {
    const { router, sent, repoId } = await setupRouter();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "reopen-1",
      type: "review.reopen",
      payload: { repoId, providerId: "github", reviewId: "7" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.reopen",
    ) as { ok?: boolean };
    expect(response?.ok).toBe(true);
  });

  it("deletes merged source branch via review.deleteSourceBranch", async () => {
    const { router, sent, repoId } = await setupRouter();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "delete-branch-1",
      type: "review.deleteSourceBranch",
      payload: { repoId, providerId: "github", reviewId: "8" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.deleteSourceBranch",
    ) as { ok?: boolean; payload?: { branch: string } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.branch).toBe("feature");
  });

  it("checks out review branch via review.checkoutBranch", async () => {
    const { router, sent, repoId, refreshNow } = await setupRouter();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "checkout-1",
      type: "review.checkoutBranch",
      payload: { repoId, providerId: "github", reviewId: "7" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.checkoutBranch",
    ) as { ok?: boolean; payload?: { branch: string } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.branch).toBe("review/pr-7");
    expect(refreshNow).toHaveBeenCalled();
  });

  it("creates a review via review.create", async () => {
    const { router, sent, repoId } = await setupRouter();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "create-1",
      type: "review.create",
      payload: {
        repoId,
        providerId: "github",
        title: "New PR",
        sourceBranch: "feature",
        targetBranch: "main",
      },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.create",
    ) as { ok?: boolean; payload?: { number: number } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.number).toBe(21);
  });

  it("creates a line comment via review.createLineComment", async () => {
    const { router, sent, repoId } = await setupRouter();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "line-comment-1",
      type: "review.createLineComment",
      payload: {
        repoId,
        providerId: "github",
        reviewId: "7",
        path: "src/app.ts",
        line: 4,
        body: "Please fix",
      },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.createLineComment",
    ) as { ok?: boolean; payload?: { commentId: string } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.commentId).toBe("501");
    const details = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "review.details",
    );
    expect(details).toBeTruthy();
  });
});