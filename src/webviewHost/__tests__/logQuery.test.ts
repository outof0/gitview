import { describe, expect, it } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import { LOG_FORMAT } from "../../services/logParser";
import { sampleLogOutput } from "../../services/__tests__/gitService.testHelpers";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import type { GitExecFn } from "../../services/git/types";

const baseRepoResponses = {
  "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
  "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
  "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
  "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
  "for-each-ref --format=%(refname:short) refs/heads/": {
    stdout: "feature\nmain\n",
    stderr: "",
  },
};

const operationVerifyReject = [
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
    if (operationVerifyReject.includes(key)) {
      return Promise.reject(new Error("missing"));
    }
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
}

describe("log.query / log.commitDetail / log.fileAtRevision handlers", () => {
  async function setupRouter(execGit: GitExecFn) {
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

  it("log.dag returns the lightweight repository graph", async () => {
    const execGit = makeExecGit({
      ...baseRepoResponses,
      "for-each-ref --format=%(objectname) refs/heads refs/remotes refs/tags": {
        stdout: "abc\n",
        stderr: "",
      },
      "log --format=%H%x00%P%x00%at --branches --remotes --tags HEAD": {
        stdout: `${["abc", "def", "1"].join("\0")}\n${["def", "", "0"].join("\0")}\n`,
        stderr: "",
      },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "dag-1",
      type: "log.dag",
      payload: { repoId },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.dag" &&
        (m as { ok?: boolean }).ok === true,
    ) as { payload?: { nodes?: Array<{ sha: string }> } };
    expect(response?.payload?.nodes?.map((node) => node.sha)).toEqual([
      "abc",
      "def",
    ]);
  });

  it("log.query scopes to a file path", async () => {
    const logOutput = sampleLogOutput("Fix greeting");
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --parents --follow --name-status --format=${LOG_FORMAT} -n 200 -- src/app.ts`]:
        {
          stdout: logOutput,
          stderr: "",
        },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-1",
      type: "log.query",
      payload: { repoId, path: "src/app.ts", isFolder: false },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.query",
    ) as { ok?: boolean; payload?: { commits?: Array<{ subject: string }> } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.commits?.[0]?.subject).toBe("Fix greeting");
    expect(
      sent.some(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type?: string }).type === "log.snapshot",
      ),
    ).toBe(true);
    // The request-driven event carries its request id so the webview can
    // drop it when a newer same-key request supersedes it.
    const event = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.snapshot",
    ) as { requestId?: string };
    expect(event?.requestId).toBe("log-1");
  });

  it("annotates filtered parents on the repo log", async () => {
    const logOutput = sampleLogOutput("Filtered commit");
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --parents --diff-merges=first-parent --name-status --format=${LOG_FORMAT} -n 200 --first-parent --branches --remotes --tags HEAD`]:
        {
          stdout: logOutput,
          stderr: "",
        },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-filtered",
      type: "log.query",
      payload: {
        repoId,
        scope: "repo",
        range: "all",
        firstParent: true,
        limit: 200,
      },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.query",
    ) as {
      ok?: boolean;
      payload?: { commits?: Array<{ parentPresent?: boolean[] }> };
    };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.commits?.[0]?.parentPresent).toEqual([true]);
  });

  it("resolves filtered parents from the full history scan", async () => {
    const logOutput = sampleLogOutput("Filtered commit");
    const parent = "1111111111111111111111111111111111111111";
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --parents --diff-merges=first-parent --name-status --format=${LOG_FORMAT} -n 200 --author=Jane --branches --remotes --tags HEAD`]:
        {
          stdout: logOutput,
          stderr: "",
        },
      [`log --format=%H --author=Jane --branches --remotes --tags HEAD`]: {
        stdout: `${parent}\n`,
        stderr: "",
      },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-author",
      type: "log.query",
      payload: {
        repoId,
        scope: "repo",
        range: "all",
        author: "Jane",
        limit: 200,
      },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.query",
    ) as {
      ok?: boolean;
      payload?: { commits?: Array<{ parentPresent?: boolean[] }> };
    };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.commits?.[0]?.parentPresent).toEqual([true]);
  });

  it("log.query scopes to a folder when isFolder is true", async () => {
    const logOutput = sampleLogOutput("Folder change");
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --parents --name-status --format=${LOG_FORMAT} -n 200 -- src/`]: {
        stdout: logOutput,
        stderr: "",
      },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-2",
      type: "log.query",
      payload: { repoId, path: "src", isFolder: true },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.query",
    ) as { ok?: boolean };
    expect(response?.ok).toBe(true);
  });

  it("forwards pagination offsets to a scoped log query", async () => {
    const logOutput = sampleLogOutput("Older file change");
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --parents --follow --name-status --format=${LOG_FORMAT} -n 100 --skip=100 -- src/app.ts`]: {
        stdout: logOutput,
        stderr: "",
      },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-page-1",
      type: "log.query",
      payload: {
        repoId,
        path: "src/app.ts",
        isFolder: false,
        limit: 100,
        skip: 100,
      },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.query",
    ) as { ok?: boolean; payload?: { filters?: { skip?: number } } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.filters?.skip).toBe(100);
  });

  it("log.query rejects unknown branch filters", async () => {
    const execGit = makeExecGit(baseRepoResponses);
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-3",
      type: "log.query",
      payload: { repoId, path: "src/app.ts", branch: "missing-branch" },
    });

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };
    expect(error?.error?.code).toBe("GIT_COMMAND_FAILED");
  });

  it("log.query rejects option-like branch refs", async () => {
    const execGit = makeExecGit(baseRepoResponses);
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "log-4",
      type: "log.query",
      payload: { repoId, path: "src/app.ts", branch: "--all" },
    });

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { message?: string } };
    expect(error?.error?.message).toContain("Invalid branch filter");
  });

  it("log.commitDetail returns commit metadata", async () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`show --no-patch --format=${LOG_FORMAT} ${sha}`]: {
        stdout: sampleLogOutput("Full commit").replace("M\tsrc/app.ts\n", ""),
        stderr: "",
      },
      [`diff-tree --no-commit-id --name-status -r -m --root ${sha}`]: {
        stdout: "M\tsrc/app.ts\n",
        stderr: "",
      },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "detail-1",
      type: "log.commitDetail",
      payload: { repoId, sha },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.commitDetail",
    ) as { ok?: boolean; payload?: { commit?: { subject: string } } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.commit?.subject).toBe("Full commit");
  });

  it("log.fileAtRevision returns revision text", async () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const execGit = makeExecGit({
      ...baseRepoResponses,
      "diff --numstat -- src/app.ts": {
        stdout: "1\t0\tsrc/app.ts\n",
        stderr: "",
      },
      [`show ${sha}:src/app.ts`]: {
        stdout: "revision body\n",
        stderr: "",
      },
    });
    const { router, sent, repoId } = await setupRouter(execGit);

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "rev-1",
      type: "log.fileAtRevision",
      payload: { repoId, sha, path: "src/app.ts" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.fileAtRevision",
    ) as { ok?: boolean; payload?: { text?: string } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.text).toBe("revision body\n");
  });
});
