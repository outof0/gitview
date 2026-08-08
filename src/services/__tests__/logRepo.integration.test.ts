import { describe, expect, it, afterEach } from "vitest";
import type { GitExecFn } from "../git/types";
import { createLogApi } from "../git/log";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("logRepo integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("filters commits by author", async () => {
    repo = await createTempGitRepo();
    const log = createLogApi(execGit);

    await writeRepoFile(repo.root, "alice.txt", "alice\n");
    await execGit(repo.root, ["add", "alice.txt"]);
    await execGit(repo.root, [
      "-c",
      "user.name=Alice",
      "-c",
      "user.email=alice@example.com",
      "commit",
      "-m",
      "Alice commit",
    ]);

    await writeRepoFile(repo.root, "bob.txt", "bob\n");
    await execGit(repo.root, ["add", "bob.txt"]);
    await execGit(repo.root, [
      "-c",
      "user.name=Bob",
      "-c",
      "user.email=bob@example.com",
      "commit",
      "-m",
      "Bob commit",
    ]);

    const result = await log.logRepo(repo.root, { author: "Alice", limit: 50 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commits.every((c) => c.author.includes("Alice"))).toBe(true);
      expect(result.commits.some((c) => c.subject === "Alice commit")).toBe(true);
      expect(result.commits.some((c) => c.subject === "Bob commit")).toBe(false);
    }
  });

  it("queries outgoing commits relative to upstream", async () => {
    const calls: string[][] = [];
    const mockExec: GitExecFn = async (_root, args) => {
      calls.push(args);
      const key = args.join(" ");
      if (key.includes("rev-parse") && key.includes("@{upstream}")) {
        return { stdout: "origin/main\n", stderr: "" };
      }
      if (args[0] === "log") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    };

    const log = createLogApi(mockExec);
    const result = await log.logRepo("/repo", { range: "outgoing", limit: 50 });
    expect(result.ok).toBe(true);
    const logCall = calls.find((args) => args[0] === "log");
    expect(logCall?.includes("origin/main..HEAD")).toBe(true);
  });
});