import { describe, expect, it, vi } from "vitest";
import { createGithubApi } from "../review/githubApi";
import { REVIEW_FETCH_TIMEOUT_MS } from "../review/reviewFetch";

describe("githubApi", () => {
  it("rejects when fetchFn never resolves", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>(() => {
          // Never resolves — simulates a hung mock that ignores AbortSignal.
        }),
    );

    const api = createGithubApi({
      token: "secret-token-123",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    const pending = api.listPullRequests(
      { owner: "acme", repo: "app", host: "github.com" },
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
      return new Response("secret-token-123 leaked", { status: 401 });
    });

    const api = createGithubApi({
      token: "secret-token-123",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    await expect(
      api.listPullRequests(
        { owner: "acme", repo: "app", host: "github.com" },
        "open",
      ),
    ).rejects.toThrow("[REDACTED]");
  });

  it("lists pull requests and maps review items with issue labels", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/pulls?")) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              number: 12,
              title: "Add login",
              state: "open",
              user: { login: "dev" },
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
              head: { ref: "feature/login" },
              base: { ref: "main" },
              html_url: "https://github.com/acme/app/pull/12",
            },
          ]),
          { status: 200 },
        );
      }
      expect(url).toContain("/repos/acme/app/issues?state=open");
      return new Response(
        JSON.stringify([
          {
            number: 12,
            labels: [{ name: "bug" }, { name: "priority" }],
            assignees: [{ login: "alice" }],
            milestone: { title: "v1.0" },
          },
        ]),
        { status: 200 },
      );
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    const items = await api.listPullRequests(
      { owner: "acme", repo: "app", host: "github.com" },
      "open",
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.number).toBe(12);
    expect(items[0]?.sourceBranch).toBe("feature/login");
    expect(items[0]?.labels).toEqual(["bug", "priority"]);
    expect(items[0]?.assignees).toEqual(["alice"]);
    expect(items[0]?.milestone).toBe("v1.0");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("creates pull requests via POST", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/repos/acme/app/pulls");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.title).toBe("New feature");
      expect(body.head).toBe("feature/x");
      expect(body.base).toBe("main");
      return new Response(
        JSON.stringify({
          id: 2,
          number: 15,
          title: "New feature",
          state: "open",
          user: { login: "dev" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
          head: { ref: "feature/x" },
          base: { ref: "main" },
        }),
        { status: 201 },
      );
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    const item = await api.createPullRequest(
      { owner: "acme", repo: "app", host: "github.com" },
      {
        title: "New feature",
        sourceBranch: "feature/x",
        targetBranch: "main",
      },
    );
    expect(item.number).toBe(15);
  });

  it("creates pull request line comments via POST", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/pulls/12/comments");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.path).toBe("src/app.ts");
      expect(body.line).toBe(4);
      expect(body.commit_id).toBe("abc123");
      return new Response(JSON.stringify({ id: 55 }), { status: 201 });
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    const result = await api.createPullReviewComment(
      { owner: "acme", repo: "app", host: "github.com" },
      12,
      {
        path: "src/app.ts",
        line: 4,
        body: "Please fix",
        commitId: "abc123",
      },
    );
    expect(result.commentId).toBe("55");
  });

  it("submits approve review via POST", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/pulls/12/reviews");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.event).toBe("APPROVE");
      return new Response("{}", { status: 200 });
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    await api.submitReview(
      { owner: "acme", repo: "app", host: "github.com" },
      12,
      "APPROVE",
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("loads pull request review comments and parses suggestions", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain("/pulls/12/comments");
      return new Response(
        JSON.stringify([
          {
            id: 99,
            user: { login: "reviewer" },
            body: "Fix typo\n```suggestion\nconst ok = true;\n```",
            path: "src/app.ts",
            line: 4,
            created_at: "2026-01-03T00:00:00Z",
          },
        ]),
        { status: 200 },
      );
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    const result = await api.getPullRequestReviewComments(
      { owner: "acme", repo: "app", host: "github.com" },
      12,
    );

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.path).toBe("src/app.ts");
    expect(result.suggestions[0]?.suggestionText).toBe("const ok = true;");
    expect(result.comments[0]?.hasSuggestion).toBe(true);
  });

  it("closes and reopens pull requests via PATCH", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      const body = JSON.parse(String(init?.body));
      if (url.endsWith("/pulls/12")) {
        expect(body.state === "closed" || body.state === "open").toBe(true);
      }
      return new Response("{}", { status: 200 });
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    await api.closePullRequest(
      { owner: "acme", repo: "app", host: "github.com" },
      12,
    );
    await api.reopenPullRequest(
      { owner: "acme", repo: "app", host: "github.com" },
      12,
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("deletes merged head branch via DELETE ref", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("DELETE");
      expect(url).toContain("/git/refs/heads/feature/login");
      return new Response(null, { status: 204 });
    });

    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn,
    });

    await api.deletePullRequestHeadBranch(
      { owner: "acme", repo: "app", host: "github.com" },
      "feature/login",
    );
  });

  it("computes provider capabilities from pull request metadata", () => {
    const api = createGithubApi({
      token: "test-token",
      apiBaseUrl: "https://api.github.com",
      fetchFn: vi.fn(),
    });

    const openCaps = api.getPullRequestCapabilities({
      id: 1,
      number: 12,
      title: "Open",
      state: "open",
      created_at: "",
      updated_at: "",
      head: { ref: "feature", repo: { full_name: "acme/app" } },
      base: { ref: "main", repo: { full_name: "acme/app" } },
    });
    expect(openCaps.canClose).toBe(true);
    expect(openCaps.canCheckoutBranch).toBe(true);

    const mergedCaps = api.getPullRequestCapabilities({
      id: 1,
      number: 12,
      title: "Merged",
      state: "closed",
      merged_at: "2026-01-01T00:00:00Z",
      created_at: "",
      updated_at: "",
      head: { ref: "feature", repo: { full_name: "acme/app" } },
      base: { ref: "main", repo: { full_name: "acme/app" } },
    });
    expect(mergedCaps.canDeleteSourceBranch).toBe(true);
    expect(mergedCaps.canCheckoutBranch).toBe(false);
  });
});