import { describe, expect, it, afterEach } from "vitest";
import { createMergeApi } from "../git/merge";
import { createSelectedChangesApi } from "../git/selectedChanges";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("selectedChanges integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("cherry-picks a selected hunk from a commit into the working tree", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const selected = createSelectedChangesApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "pick.txt", "base\npicked\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add picked line"]);
    const { stdout: sha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Reset file to base"]);

    await selected.cherryPickSelected(repo.root, sha.trim(), "pick.txt", {
      hunkIndexes: [0],
    });

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/pick.txt`, "utf8"),
    );
    expect(content).toBe("base\npicked\n");
  });

  it("drops selected hunks from HEAD via amend", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const selected = createSelectedChangesApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "pick.txt", "base\npicked\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add picked line"], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Original Author",
        GIT_AUTHOR_EMAIL: "original@example.com",
        GIT_AUTHOR_DATE: "2001-02-03T04:05:06+00:00",
      },
    });
    const { stdout: headSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    const { stdout: originalAuthor } = await execGit(repo.root, [
      "show",
      "-s",
      "--format=%an%x00%ae%x00%at",
      "HEAD",
    ]);

    await selected.dropSelectedFromHead(
      repo.root,
      headSha.trim(),
      "pick.txt",
      { hunkIndexes: [0] },
      headSha.trim(),
    );

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/pick.txt`, "utf8"),
    );
    expect(content).toBe("base\n");
    const { stdout: log } = await execGit(repo.root, ["log", "--oneline"]);
    expect(log).toContain("Add picked line");
    const { stdout: author } = await execGit(repo.root, [
      "show",
      "-s",
      "--format=%an%x00%ae%x00%at",
      "HEAD",
    ]);
    expect(author.trim()).toBe(originalAuthor.trim());
  });

  it("refuses to drop when HEAD moved after the commit was selected", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);
    const selected = createSelectedChangesApi(execGit, merge.isBinaryFile);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "pick.txt", "base\npicked\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add picked line"]);
    const { stdout: selectedSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    // Another terminal or Git client commits while the drop is being prepared.
    // The caller still hands over the SHA it resolved earlier, so the
    // `sha === headSha` guard alone would pass against a stale HEAD.
    await writeRepoFile(repo.root, "elsewhere.txt", "elsewhere\n");
    await execGit(repo.root, ["add", "elsewhere.txt"]);
    await execGit(repo.root, ["commit", "-m", "Unrelated commit"]);
    const { stdout: headBefore } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    await expect(
      selected.dropSelectedFromHead(
        repo.root,
        selectedSha.trim(),
        "pick.txt",
        { hunkIndexes: [0] },
        selectedSha.trim(),
      ),
    ).rejects.toThrow(/HEAD moved to/i);

    // Nothing was rewritten: HEAD is still the unrelated commit and the picked
    // line is still committed.
    const { stdout: headAfter } = await execGit(repo.root, ["rev-parse", "HEAD"]);
    expect(headAfter.trim()).toBe(headBefore.trim());
    const { stdout: content } = await execGit(repo.root, [
      "show",
      `${selectedSha.trim()}:pick.txt`,
    ]);
    expect(content).toBe("base\npicked\n");
  });

  it("does not rewrite a commit that wins the race immediately before mutation", async () => {
    repo = await createTempGitRepo();
    const merge = createMergeApi(execGit);

    await writeRepoFile(repo.root, "pick.txt", "base\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Base"]);

    await writeRepoFile(repo.root, "pick.txt", "base\npicked\n");
    await execGit(repo.root, ["add", "pick.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add picked line"]);
    const { stdout: selectedSha } = await execGit(repo.root, ["rev-parse", "HEAD"]);

    let moved = false;
    const racingExec: typeof execGit = async (repoRoot, args, options) => {
      if (!moved && args[0] === "update-ref" && args[1] === "HEAD") {
        moved = true;
        await writeRepoFile(repoRoot, "elsewhere.txt", "external\n");
        await execGit(repoRoot, ["add", "elsewhere.txt"]);
        await execGit(repoRoot, ["commit", "-m", "External commit"]);
      }
      return execGit(repoRoot, args, options);
    };
    const selected = createSelectedChangesApi(racingExec, merge.isBinaryFile);

    await expect(
      selected.dropSelectedFromHead(
        repo.root,
        selectedSha.trim(),
        "pick.txt",
        { hunkIndexes: [0] },
        selectedSha.trim(),
      ),
    ).rejects.toThrow(/HEAD moved to/i);

    const { stdout: message } = await execGit(repo.root, [
      "log",
      "-1",
      "--format=%s",
    ]);
    expect(message.trim()).toBe("External commit");
    expect(await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/pick.txt`, "utf8"),
    )).toBe("base\npicked\n");
  });
});
