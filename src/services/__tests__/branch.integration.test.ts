import { describe, expect, it, afterEach } from "vitest";
import { createBranchApi } from "../git/branch";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("branch integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("lists local branches with current flag", async () => {
    repo = await createTempGitRepo();
    const branches = createBranchApi(execGit);

    await execGit(repo.root, ["branch", "feature/test"]);

    const entries = await branches.listBranchEntries(repo.root, "repo-1");
    const main = entries.find((b) => b.fullName === "main");
    const feature = entries.find((b) => b.fullName === "feature/test");

    expect(main?.current).toBe(true);
    expect(feature?.current).toBe(false);
    expect(feature?.remote).toBe(false);
  });

  it("creates a branch without leaving the current one", async () => {
    repo = await createTempGitRepo();
    const branches = createBranchApi(execGit);

    await branches.createBranch(repo.root, "dev", undefined, {
      checkout: false,
    });

    const { stdout } = await execGit(repo.root, ["branch", "--show-current"]);
    expect(stdout.trim()).toBe("main");
    const entries = await branches.listBranchEntries(repo.root, "repo-1");
    expect(entries.some((b) => b.fullName === "dev")).toBe(true);
  });

  it("resets an existing branch only when forced", async () => {
    repo = await createTempGitRepo();
    const branches = createBranchApi(execGit);

    await branches.createBranch(repo.root, "dev");
    await writeRepoFile(repo.root, "dev.txt", "dev work\n");
    await execGit(repo.root, ["add", "."]);
    await execGit(repo.root, ["commit", "-m", "dev commit"]);
    const { stdout: devSha } = await execGit(repo.root, ["rev-parse", "dev"]);
    const { stdout: mainSha } = await execGit(repo.root, ["rev-parse", "main"]);
    expect(devSha.trim()).not.toBe(mainSha.trim());

    await expect(
      branches.createBranch(repo.root, "dev", "main"),
    ).rejects.toThrow();

    await branches.createBranch(repo.root, "dev", "main", { force: true });
    const { stdout: resetSha } = await execGit(repo.root, ["rev-parse", "dev"]);
    expect(resetSha.trim()).toBe(mainSha.trim());
  });

  it("checks out another branch", async () => {
    repo = await createTempGitRepo();
    const branches = createBranchApi(execGit);

    await branches.createBranch(repo.root, "dev");
    await writeRepoFile(repo.root, "dev.txt", "dev work\n");
    await branches.checkout(repo.root, "main");

    const { stdout } = await execGit(repo.root, ["branch", "--show-current"]);
    expect(stdout.trim()).toBe("main");
  });

  it("smart checkout stashes dirty work and restores it", async () => {
    repo = await createTempGitRepo();
    const branches = createBranchApi(execGit);

    await branches.createBranch(repo.root, "dev");
    await branches.checkout(repo.root, "main");
    await writeRepoFile(repo.root, "dirty.txt", "local edits\n");

    await branches.checkout(repo.root, "dev", { smart: true });

    const { stdout } = await execGit(repo.root, ["branch", "--show-current"]);
    expect(stdout.trim()).toBe("dev");

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/dirty.txt`, "utf8"),
    );
    expect(content).toBe("local edits\n");
  });
});