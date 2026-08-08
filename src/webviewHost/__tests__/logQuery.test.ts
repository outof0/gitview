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

  it("log.query scopes to a file path", async () => {
    const logOutput = sampleLogOutput("Fix greeting");
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --follow --name-status --format=${LOG_FORMAT} -n 200 -- src/app.ts`]: {
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
  });

  it("log.query scopes to a folder when isFolder is true", async () => {
    const logOutput = sampleLogOutput("Folder change");
    const execGit = makeExecGit({
      ...baseRepoResponses,
      [`log --name-status --format=${LOG_FORMAT} -n 200 -- src/`]: {
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
      [`show --format=fuller --no-patch ${sha}`]: {
        stdout: `commit ${sha} (aaaaaaa)
Author: Jane Doe <jane@example.com>
Commit: Jane Doe <jane@example.com>

    Full commit
`,
        stderr: "",
      },
      [`show --format=%b --no-patch ${sha}`]: {
        stdout: "",
        stderr: "",
      },
      [`show --name-status --format= ${sha}`]: {
        stdout: "M\tsrc/app.ts\n",
        stderr: "",
      },
      [`show -s --format=%at ${sha}`]: {
        stdout: "1719000000\n",
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