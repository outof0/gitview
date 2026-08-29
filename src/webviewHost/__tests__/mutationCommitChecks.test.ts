import { describe, expect, it, vi } from "vitest";
import { createProtectionService } from "../../services/protectionService";
import { createRepositoryService } from "../../services/repositoryService";
import type { GitExecFn } from "../../services/git/types";
import { createMutationHandlers } from "../handlers/mutations";

function createExecGit(): GitExecFn {
  return async (_repoRoot, args) => {
    const key = args.join(" ");
    if (key === "rev-parse --git-dir") {
      return { stdout: ".git\n", stderr: "" };
    }
    if (key === "rev-parse HEAD") {
      return { stdout: "abc\n", stderr: "" };
    }
    if (key === "status --porcelain=v1 -z -b") {
      return { stdout: "## main\0M  staged.ts\0 M working.ts\0", stderr: "" };
    }
    if (key === "remote") {
      return { stdout: "", stderr: "" };
    }
    if (key === "diff --cached --name-only -z --diff-filter=ACDMRTUXB") {
      return { stdout: "staged.ts\0", stderr: "" };
    }
    throw new Error(`Unexpected git call: ${key}`);
  };
}

async function setup() {
  const execGit = createExecGit();
  const repositoryService = createRepositoryService({
    execGit,
    discoverGitRoots: async () => ["/repo"],
  });
  const runChecks = vi.fn().mockResolvedValue({ ok: true, issues: [] });
  const sent: unknown[] = [];
  const handlers = createMutationHandlers({
    execGit,
    repositoryService,
    protectionService: createProtectionService([]),
    refreshCoordinator: {
      refreshNow: vi.fn(),
    } as never,
    commitCheckService: { runChecks } as never,
    trusted: true,
    workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
    postMessage: (message) => sent.push(message),
  });
  const [repository] = await repositoryService.discoverRepositories({
    workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
    trusted: true,
  });
  return { handlers, repository: repository!, runChecks, sent };
}

describe("commit checks", () => {
  it("checks staged paths when the request omits paths", async () => {
    const { handlers, repository, runChecks, sent } = await setup();

    await handlers.runCommitChecks("checks-1", repository.id);

    expect(runChecks).toHaveBeenCalledWith("/repo", ["staged.ts"], {
      kinds: undefined,
      applyFixes: false,
    });
    expect(
      sent.some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          (message as { type?: string }).type === "commit.checks",
      ),
    ).toBe(true);
  });
});
