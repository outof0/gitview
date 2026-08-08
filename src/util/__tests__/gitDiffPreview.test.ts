import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildParentCommitDiffView,
  buildRootCommitDiffView,
  buildWorkingTreeDiffView,
} from "../gitDiffPreview";

describe("gitDiffPreview", () => {
  let repoRoot = "";

  afterEach(async () => {
    if (repoRoot) {
      await fs.rm(repoRoot, { recursive: true, force: true });
      repoRoot = "";
    }
  });

  async function initRepo(files: Record<string, string>): Promise<void> {
    repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nx-diff-preview-"));
    await fs.mkdir(path.join(repoRoot, ".git"), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const absolute = path.join(repoRoot, rel);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, content, "utf8");
    }
  }

  it("buildWorkingTreeDiffView treats a missing worktree file as empty", async () => {
    await initRepo({ "tracked.txt": "head\n" });
    const diff = await buildWorkingTreeDiffView(repoRoot, "tracked.txt");
    expect(diff.right?.text).toBe("head\n");

    await fs.rm(path.join(repoRoot, "tracked.txt"));
    const deleted = await buildWorkingTreeDiffView(repoRoot, "tracked.txt");
    expect(deleted.right?.text).toBe("");
  });

  it("buildParentCommitDiffView uses single panel when revisions match", async () => {
    await initRepo({});
    const diff = await buildParentCommitDiffView(
      repoRoot,
      "missing.ts",
      "parent1234567890abcdef1234567890abcdef123456",
      "child1234567890abcdef1234567890abcdef123456",
    );
    expect(diff.layout).toBe("single");
  });

  it("buildRootCommitDiffView uses single panel for new files", async () => {
    await initRepo({});
    const diff = await buildRootCommitDiffView(
      repoRoot,
      "new.ts",
      "abc1234567890abcdef1234567890abcdef123456",
    );
    expect(diff.layout).toBe("single");
    expect(diff.status).toBe("A");
  });
});