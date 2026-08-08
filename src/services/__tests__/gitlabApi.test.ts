import { describe, expect, it, vi } from "vitest";
import { createGitlabApi } from "../review/gitlabApi";
import { encodeGitlabProjectPath } from "../review/gitlabRemote";
import { REVIEW_FETCH_TIMEOUT_MS } from "../review/reviewFetch";

describe("gitlabApi", () => {
  it("rejects when fetchFn never resolves", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>(() => {
          // Never resolves — simulates a hung mock that ignores AbortSignal.
        }),
    );

    const api = createGitlabApi({
      token: "secret-token-456",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    const pending = api.listMergeRequests(
      { projectPath: "acme/app", host: "gitlab.com" },
      "open",
    );
    const assertion = expect(pending).rejects.toThrow(
      `Request timed out after ${REVIEW_FETCH_TIMEOUT_MS}ms`,
    );

    await vi.advanceTimersByTimeAsync(REVIEW_FETCH_TIMEOUT_MS);
    await assertion;
    vi.useRealTimers();
  });

  it("redacts tokens in HTTP error messages", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response("secret-token-456 leaked", { status: 401 });
    });

    const api = createGitlabApi({
      token: "secret-token-456",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    await expect(
      api.listMergeRequests(
        { projectPath: "acme/app", host: "gitlab.com" },
        "open",
      ),
    ).rejects.toThrow("[REDACTED]");
  });

  it("lists merge requests and maps review items", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain(
        `/projects/${encodeGitlabProjectPath("acme/app")}/merge_requests?state=opened`,
      );
      return new Response(
        JSON.stringify([
          {
            id: 10,
            iid: 7,
            title: "Feature",
            state: "opened",
            author: { username: "dev" },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            source_branch: "feature",
            target_branch: "main",
            web_url: "https://gitlab.com/acme/app/-/merge_requests/7",
          },
        ]),
        { status: 200 },
      );
    });

    const api = createGitlabApi({
      token: "test-token",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    const items = await api.listMergeRequests(
      { projectPath: "acme/app", host: "gitlab.com" },
      "open",
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.number).toBe(7);
    expect(items[0]?.sourceBranch).toBe("feature");
  });

  it("approves merge request via POST", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/merge_requests/12/approve");
      expect(init?.method).toBe("POST");
      return new Response("{}", { status: 200 });
    });

    const api = createGitlabApi({
      token: "test-token",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    await api.submitReview(
      { projectPath: "acme/app", host: "gitlab.com" },
      12,
      "APPROVE",
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("parses suggestions from discussion notes", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain("/merge_requests/12/discussions");
      return new Response(
        JSON.stringify([
          {
            id: "abc",
            notes: [
              {
                id: 44,
                author: { username: "reviewer" },
                body: "Fix typo\n```suggestion\nconst ok = true;\n```",
                created_at: "2026-01-03T00:00:00Z",
                system: false,
                position: {
                  new_path: "src/app.ts",
                  new_line: 4,
                },
              },
            ],
          },
        ]),
        { status: 200 },
      );
    });

    const api = createGitlabApi({
      token: "test-token",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    const result = await api.getMergeRequestDiscussions(
      { projectPath: "acme/app", host: "gitlab.com" },
      12,
    );

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.path).toBe("src/app.ts");
    expect(result.suggestions[0]?.suggestionText).toBe("const ok = true;");
  });

  it("merges with rebase via rebase endpoint then merge", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/rebase")) {
        expect(init?.method).toBe("PUT");
        return new Response("{}", { status: 200 });
      }
      expect(init?.method).toBe("PUT");
      const body = JSON.parse(String(init?.body));
      expect(body.squash).toBe(false);
      return new Response("{}", { status: 200 });
    });

    const api = createGitlabApi({
      token: "test-token",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    await api.mergeMergeRequest(
      { projectPath: "acme/app", host: "gitlab.com" },
      12,
      "rebase",
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("creates merge requests via POST", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/merge_requests");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.source_branch).toBe("feature/x");
      expect(body.target_branch).toBe("main");
      return new Response(
        JSON.stringify({
          id: 10,
          iid: 9,
          title: "New MR",
          state: "opened",
          author: { username: "dev" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
          source_branch: "feature/x",
          target_branch: "main",
        }),
        { status: 201 },
      );
    });

    const api = createGitlabApi({
      token: "test-token",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    const item = await api.createMergeRequest(
      { projectPath: "acme/app", host: "gitlab.com" },
      {
        title: "New MR",
        sourceBranch: "feature/x",
        targetBranch: "main",
      },
    );
    expect(item.number).toBe(9);
  });

  it("creates merge request line comments via discussions POST", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/discussions");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.position.new_path).toBe("src/app.ts");
      expect(body.position.new_line).toBe(4);
      return new Response(JSON.stringify({ notes: [{ id: 77 }] }), {
        status: 201,
      });
    });

    const api = createGitlabApi({
      token: "test-token",
      apiBaseUrl: "https://gitlab.com/api/v4",
      fetchFn,
    });

    const result = await api.createMergeRequestLineComment(
      { projectPath: "acme/app", host: "gitlab.com" },
      12,
      {
        path: "src/app.ts",
        line: 4,
        body: "Please fix",
        baseSha: "base",
        startSha: "start",
        headSha: "head",
      },
    );
    expect(result.commentId).toBe("77");
  });
});