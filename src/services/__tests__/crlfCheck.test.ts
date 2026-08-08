import { describe, expect, it, afterEach } from "vitest";
import { createCrlfCheckApi } from "../git/crlfCheck";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("crlfCheck", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("warns when file line endings disagree with gitattributes eol", async () => {
    repo = await createTempGitRepo();
    const crlfCheck = createCrlfCheckApi(execGit);

    await writeRepoFile(repo.root, ".gitattributes", "*.txt eol=crlf\n");
    await writeRepoFile(repo.root, "windows.txt", "line one\nline two\n");
    await execGit(repo.root, ["add", ".gitattributes", "windows.txt"]);
    await execGit(repo.root, ["commit", "-m", "Track text files"]);

    const result = await crlfCheck.checkFile(repo.root, "windows.txt");
    expect(result.warn).toBe(true);
    expect(result.message).toContain("windows.txt");
    expect(result.expectedEol).toBe("crlf");
    expect(result.fileEol).toBe("lf");
  });

  it("does not warn when line endings match gitattributes", async () => {
    repo = await createTempGitRepo();
    const crlfCheck = createCrlfCheckApi(execGit);

    await writeRepoFile(repo.root, ".gitattributes", "*.txt eol=lf\n");
    await writeRepoFile(repo.root, "unix.txt", "alpha\nbeta\n");
    await execGit(repo.root, ["add", ".gitattributes", "unix.txt"]);
    await execGit(repo.root, ["commit", "-m", "Track unix files"]);

    const result = await crlfCheck.checkFile(repo.root, "unix.txt");
    expect(result.warn).toBe(false);
    expect(result.message).toBeNull();
  });
});