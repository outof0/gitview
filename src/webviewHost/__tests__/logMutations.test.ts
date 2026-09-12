import { describe, expect, it, vi } from "vitest";
import { createLogHandlers } from "../handlers/log";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import type {
  DropCommitConfirmationEvidence,
  DropSelectedConfirmationEvidence,
  HardResetConfirmationEvidence,
} from "../../shared/types/confirmation";

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
): GitExecFn {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
}

describe("log handlers mutations", () => {
  it("requires confirmation for destructive reset", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
    });

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
    const handlers = createLogHandlers({
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

    await handlers.reset("reset-1", repos[0]!.id, "deadbeef", "hard");

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as {
      error?: {
        code?: string;
        details?: { confirmation?: HardResetConfirmationEvidence };
      };
    };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
    expect(error?.error?.details?.confirmation).toMatchObject({
      action: "hard_reset",
      repoId: repos[0]!.id,
      targetSha: "deadbeef",
      resetMode: "hard",
      repository: { headSha: "abc" },
    });
  });

  it("rejects stale hard reset evidence before mutation", async () => {
    let headSha = "abc";
    const execGit = vi.fn<GitExecFn>(async (_repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: `${headSha}\n`, stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0", stderr: "" };
      }
      if (key === "remote") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    });
    const workspaceFolders = [{ uriPath: "/repo", name: "repo" }];
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => workspaceFolders,
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders,
      postMessage: (message) => sent.push(message),
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders,
      trusted: true,
    });

    await handlers.reset("preflight", repos[0]!.id, "deadbeef", "hard");
    const preflight = sent.at(-1) as {
      error: { details: { confirmation: HardResetConfirmationEvidence } };
    };
    headSha = "new-head";
    sent.length = 0;
    await handlers.reset(
      "submit",
      repos[0]!.id,
      "deadbeef",
      "hard",
      false,
      {
        evidence: preflight.error.details.confirmation,
        typedValue: "main",
      },
    );

    expect(sent.at(-1)).toMatchObject({
      ok: false,
      error: {
        code: "CONFIRMATION_STALE",
        details: {
          confirmation: { repository: { headSha: "new-head" } },
        },
      },
    });
    expect(
      execGit.mock.calls.some(([, args]) => args[0] === "reset"),
    ).toBe(false);
  });

  it("runs hard reset only with exact current typed evidence", async () => {
    const execGit = vi.fn<GitExecFn>(async (_repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: "abc\n", stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0", stderr: "" };
      }
      if (key === "remote") {
        return { stdout: "", stderr: "" };
      }
      if (key === "reset --hard deadbeef") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    });
    const workspaceFolders = [{ uriPath: "/repo", name: "repo" }];
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => workspaceFolders,
      getTrusted: () => true,
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
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders,
      postMessage: (message) => sent.push(message),
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders,
      trusted: true,
    });

    await handlers.reset("preflight", repos[0]!.id, "deadbeef", "hard");
    const evidence = (
      sent.at(-1) as {
        error: { details: { confirmation: HardResetConfirmationEvidence } };
      }
    ).error.details.confirmation;
    sent.length = 0;
    await handlers.reset(
      "submit",
      repos[0]!.id,
      "deadbeef",
      "hard",
      false,
      { evidence, typedValue: evidence.expectedTypedValue },
    );

    expect(sent.at(-1)).toMatchObject({
      ok: true,
      type: "log.reset",
      payload: { sha: "deadbeef", mode: "hard" },
    });
    expect(
      execGit.mock.calls.filter(([, args]) => args[0] === "reset"),
    ).toHaveLength(1);
  });

  it("requires confirmation before undoing the last commit", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
    });

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
    const handlers = createLogHandlers({
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

    await handlers.undoLastCommit("undo-1", repos[0]!.id);

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("undoes the last commit with mixed reset when confirmed", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "reset --mixed HEAD~1": { stdout: "", stderr: "" },
    });

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
    const refreshNow = vi.spyOn(refreshCoordinator, "refreshNow").mockResolvedValue({
      repoSnapshot: { repositories: [], activeRepoId: null, multiRootDiverged: false },
      statusByRepoId: new Map(),
      traceId: "test",
    });

    const handlers = createLogHandlers({
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

    await handlers.undoLastCommit("undo-1", repos[0]!.id, true);

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.undoLastCommit",
    ) as { ok?: boolean; payload?: { ok: boolean } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ok).toBe(true);
    expect(refreshNow).toHaveBeenCalled();
  });

  it("requires confirmation before dropping a commit", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
    });

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
    const handlers = createLogHandlers({
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

    await handlers.dropCommit("drop-1", repos[0]!.id, "deadbeef");

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as {
      error?: {
        code?: string;
        details?: { confirmation?: DropCommitConfirmationEvidence };
      };
    };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
    expect(error?.error?.details?.confirmation).toMatchObject({
      action: "drop_commit",
      repoId: repos[0]!.id,
      targetSha: "deadbeef",
      expectedTypedValue: "deadbee",
    });
  });

  it("rejects stale commit drop evidence before rebase", async () => {
    let headSha = "abc";
    const execGit = vi.fn<GitExecFn>(async (_repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: `${headSha}\n`, stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0", stderr: "" };
      }
      if (key === "remote") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    });
    const workspaceFolders = [{ uriPath: "/repo", name: "repo" }];
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => workspaceFolders,
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders,
      postMessage: (message) => sent.push(message),
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders,
      trusted: true,
    });

    await handlers.dropCommit("preflight", repos[0]!.id, "deadbeef");
    const evidence = (
      sent.at(-1) as {
        error: { details: { confirmation: DropCommitConfirmationEvidence } };
      }
    ).error.details.confirmation;
    headSha = "new-head";
    sent.length = 0;
    await handlers.dropCommit("submit", repos[0]!.id, "deadbeef", {
      evidence,
      typedValue: evidence.expectedTypedValue,
    });

    expect(sent.at(-1)).toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_STALE" },
    });
    expect(execGit.mock.calls.some(([, args]) => args[0] === "rebase")).toBe(
      false,
    );
  });

  it("rejects stale selected-change evidence before rewriting HEAD", async () => {
    let headSha = "abc123456";
    const execGit = vi.fn<GitExecFn>(async (_repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: `${headSha}\n`, stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0", stderr: "" };
      }
      if (key === "remote") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    });
    const workspaceFolders = [{ uriPath: "/repo", name: "repo" }];
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => workspaceFolders,
      getTrusted: () => true,
    });
    const sent: unknown[] = [];
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders,
      postMessage: (message) => sent.push(message),
    });
    const repos = await repositoryService.discoverRepositories({
      workspaceFolders,
      trusted: true,
    });

    await handlers.dropSelectedChanges(
      "preflight",
      repos[0]!.id,
      "abc123456",
      "src/app.ts",
      [0],
    );
    const evidence = (
      sent.at(-1) as {
        error: { details: { confirmation: DropSelectedConfirmationEvidence } };
      }
    ).error.details.confirmation;
    headSha = "new-head";
    sent.length = 0;
    await handlers.dropSelectedChanges(
      "submit",
      repos[0]!.id,
      "abc123456",
      "src/app.ts",
      [0],
      undefined,
      { evidence, typedValue: evidence.expectedTypedValue },
    );

    expect(sent.at(-1)).toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_STALE" },
    });
    expect(execGit.mock.calls.some(([, args]) => args[0] === "reset")).toBe(
      false,
    );
  });

  it("requires confirmation before editing a commit message", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
    });

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
    const handlers = createLogHandlers({
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

    await handlers.editMessage(
      "edit-1",
      repos[0]!.id,
      "deadbeef",
      "new subject",
    );

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("extracts changes from a commit", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "cherry-pick -n deadbeef": { stdout: "", stderr: "" },
    });

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
    const refreshNow = vi.spyOn(refreshCoordinator, "refreshNow").mockResolvedValue({
      repoSnapshot: { repositories: [], activeRepoId: null, multiRootDiverged: false },
      statusByRepoId: new Map(),
      traceId: "test",
    });

    const handlers = createLogHandlers({
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

    await handlers.extractChangesFromCommit(
      "extract-1",
      repos[0]!.id,
      "deadbeef",
    );

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.extractChanges",
    ) as { ok?: boolean; payload?: { sha: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.sha).toBe("deadbeef");
    expect(refreshNow).toHaveBeenCalled();
  });
});