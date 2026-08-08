import { describe, expect, it, afterEach } from "vitest";
import { createLogApi } from "../git/log";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("large repo log responsiveness", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("returns bounded commit history for repos with many commits", async () => {
    repo = await createTempGitRepo();
    const log = createLogApi(execGit);

    for (let index = 0; index < 120; index += 1) {
      await writeRepoFile(repo.root, `files/f-${index}.txt`, `v${index}\n`);
      await execGit(repo.root, ["add", `files/f-${index}.txt`]);
      await execGit(repo.root, ["commit", "-m", `commit ${index}`]);
    }

    const started = performance.now();
    const result = await log.logRepo(repo.root, { limit: 100 });
    const elapsed = performance.now() - started;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commits.length).toBeLessThanOrEqual(100);
      expect(result.commits.length).toBeGreaterThan(0);
    }
    expect(elapsed).toBeLessThan(15_000);
  }, 60_000);
});