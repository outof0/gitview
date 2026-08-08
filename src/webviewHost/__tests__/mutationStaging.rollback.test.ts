import { describe, expect, it, vi } from "vitest";
import { createMutationHandlers } from "../handlers/mutations";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import type { GitFileStatus } from "../../shared/types/status";

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

async function setup(opts?: {
  confirmDestructive?: boolean;
}) {
  const execGit = makeExecGit({
    "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
    "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
    "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
    "restore -- file.ts": { stdout: "", stderr: "" },
    "clean -f -- untracked.txt": { stdout: "", stderr: "" },
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
  const refreshNow = vi
    .spyOn(refreshCoordinator, "refreshNow")
    .mockResolvedValue({
      repoSnapshot: {
        repositories: [],
        activeRepoId: null,
        multiRootDiverged: false,
      },
      statusByRepoId: new Map(),
      traceId: "test",
    });

  const sent: unknown[] = [];
  const handlers = createMutationHandlers({
    execGit,
    repositoryService,
    protectionService: createProtectionService([]),
    refreshCoordinator,
    trusted: true,
    workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
    postMessage: (msg) => sent.push(msg),
    getConfirmDestructiveActions: () => opts?.confirmDestructive !== false,
  });

  const repos = await repositoryService.discoverRepositories({
    workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
    trusted: true,
  });

  return { handlers, repos, sent, refreshNow, execGit };
}

function errorCode(sent: unknown[]): string | undefined {
  const error = sent.find(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      (m as { ok?: boolean }).ok === false,
  ) as { error?: { code?: string; message?: string } };
  return error?.error?.code;
}

describe("mutationStaging.rollback confirmation", () => {
  it("requires confirmation for tracked rollback when confirmDestructiveActions is true", async () => {
    const { handlers, repos, sent } = await setup({
      confirmDestructive: true,
    });
    const files: GitFileStatus[] = [
      {
        repoId: repos[0]!.id,
        path: "file.ts",
        kind: "modified",
        indexStatus: " ",
        workingTreeStatus: "M",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ];

    await handlers.rollback("rb-1", repos[0]!.id, ["file.ts"], false, files);

    expect(errorCode(sent)).toBe("DESTRUCTIVE_ACTION_DENIED");
    expect(
      (sent.find((m) => (m as { ok?: boolean }).ok === false) as {
        error?: { message?: string };
      })?.error?.message,
    ).toMatch(/requires confirmation/i);
  });

  it("allows tracked rollback when confirmed", async () => {
    const { handlers, repos, sent, refreshNow } = await setup({
      confirmDestructive: true,
    });
    const files: GitFileStatus[] = [
      {
        repoId: repos[0]!.id,
        path: "file.ts",
        kind: "modified",
        indexStatus: " ",
        workingTreeStatus: "M",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ];

    await handlers.rollback("rb-2", repos[0]!.id, ["file.ts"], true, files);

    const ok = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === true &&
        (m as { type?: string }).type === "changes.rollback",
    );
    expect(ok).toBeTruthy();
    expect(refreshNow).toHaveBeenCalled();
  });

  it("skips confirm for tracked-only rollback when confirmDestructiveActions is false", async () => {
    const { handlers, repos, sent } = await setup({
      confirmDestructive: false,
    });
    const files: GitFileStatus[] = [
      {
        repoId: repos[0]!.id,
        path: "file.ts",
        kind: "modified",
        indexStatus: " ",
        workingTreeStatus: "M",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ];

    await handlers.rollback("rb-3", repos[0]!.id, ["file.ts"], false, files);

    expect(errorCode(sent)).toBeUndefined();
    expect(
      sent.some(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type?: string }).type === "changes.rollback",
      ),
    ).toBe(true);
  });

  it("still requires confirmation for unversioned files even when confirmDestructiveActions is false", async () => {
    const { handlers, repos, sent } = await setup({
      confirmDestructive: false,
    });
    const files: GitFileStatus[] = [
      {
        repoId: repos[0]!.id,
        path: "untracked.txt",
        kind: "unversioned",
        indexStatus: "?",
        workingTreeStatus: "?",
        staged: false,
        conflicted: false,
        binary: false,
      },
    ];

    await handlers.rollback(
      "rb-4",
      repos[0]!.id,
      ["untracked.txt"],
      false,
      files,
    );

    expect(errorCode(sent)).toBe("DESTRUCTIVE_ACTION_DENIED");
  });
});
