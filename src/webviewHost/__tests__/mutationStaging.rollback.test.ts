import { describe, expect, it, vi } from "vitest";
import { createMutationHandlers } from "../handlers/mutations";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import type { RollbackConfirmationEvidence } from "../../shared/types/confirmation";
import type { GitFileStatus } from "../../shared/types/status";

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
): GitExecFn {
  return vi.fn((_repoRoot, args) => {
    const key = args.join(" ");
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  });
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

function rollbackEvidence(sent: unknown[]): RollbackConfirmationEvidence {
  const error = sent.find(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      (message as { ok?: boolean }).ok === false,
  ) as {
    error?: { details?: { confirmation?: RollbackConfirmationEvidence } };
  };
  const evidence = error.error?.details?.confirmation;
  if (!evidence) {
    throw new Error("Expected rollback confirmation evidence");
  }
  return evidence;
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

    await handlers.rollback("rb-1", repos[0]!.id, ["file.ts"], undefined, files);

    expect(errorCode(sent)).toBe("CONFIRMATION_REQUIRED");
    expect(rollbackEvidence(sent)).toMatchObject({
      action: "rollback",
      paths: ["file.ts"],
      unversionedPaths: [],
      expectedTypedValue: "ROLLBACK",
    });
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

    await handlers.rollback("rb-2-preflight", repos[0]!.id, ["file.ts"], undefined, files);
    const evidence = rollbackEvidence(sent);
    sent.length = 0;

    await handlers.rollback(
      "rb-2",
      repos[0]!.id,
      ["file.ts"],
      { evidence, typedValue: evidence.expectedTypedValue },
      files,
    );

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

    await handlers.rollback("rb-3", repos[0]!.id, ["file.ts"], undefined, files);

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
      undefined,
      files,
    );

    expect(errorCode(sent)).toBe("CONFIRMATION_REQUIRED");
    expect(rollbackEvidence(sent)).toMatchObject({
      paths: ["untracked.txt"],
      unversionedPaths: ["untracked.txt"],
      expectedTypedValue: "DELETE",
    });
  });

  it("does not restore or clean when unversioned classification changed", async () => {
    const { handlers, repos, sent, execGit } = await setup({
      confirmDestructive: false,
    });
    const unversioned: GitFileStatus[] = [
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
    const tracked: GitFileStatus[] = [
      {
        ...unversioned[0]!,
        kind: "modified",
        indexStatus: " ",
        workingTreeStatus: "M",
      },
    ];

    await handlers.rollback(
      "rb-stale-preflight",
      repos[0]!.id,
      ["untracked.txt"],
      undefined,
      unversioned,
    );
    const evidence = rollbackEvidence(sent);
    sent.length = 0;

    await handlers.rollback(
      "rb-stale-submit",
      repos[0]!.id,
      ["untracked.txt"],
      { evidence, typedValue: evidence.expectedTypedValue },
      tracked,
    );

    expect(errorCode(sent)).toBe("CONFIRMATION_STALE");
    expect(execGit).not.toHaveBeenCalledWith("/repo", [
      "clean",
      "-f",
      "--",
      "untracked.txt",
    ]);
    expect(execGit).not.toHaveBeenCalledWith("/repo", [
      "restore",
      "--",
      "untracked.txt",
    ]);
  });
});
