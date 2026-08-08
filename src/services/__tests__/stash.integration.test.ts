import { describe, expect, it, afterEach } from "vitest";
import { createStashApi } from "../git/stash";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("stash integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("pushes and lists a stash entry", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "stash-me.txt", "hello\n");
    await execGit(repo.root, ["add", "stash-me.txt"]);

    await stash.push(repo.root, { message: "Test stash" });
    const entries = await stash.listStashes(repo.root);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.message).toContain("Test stash");
  });

  it("applies and drops a stash entry", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "pop-me.txt", "pop\n");
    await execGit(repo.root, ["add", "pop-me.txt"]);
    await stash.push(repo.root, { message: "Pop test" });

    await stash.pop(repo.root, 0);
    const entries = await stash.listStashes(repo.root);
    expect(entries).toHaveLength(0);

    const content = await import("fs/promises").then((fs) =>
      fs.readFile(`${repo!.root}/pop-me.txt`, "utf8"),
    );
    expect(content).toBe("pop\n");
  });

  it("records the branch and an ISO date for each entry", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "dated.txt", "x\n");
    await execGit(repo.root, ["add", "dated.txt"]);
    await stash.push(repo.root, { message: "Dated stash" });

    const [entry] = await stash.listStashes(repo.root);
    expect(entry?.branch).toBeTruthy();
    expect(Number.isNaN(Date.parse(entry?.authoredAt ?? ""))).toBe(false);
    expect(entry?.relativeDate).toBeTruthy();
  });

  it("keeps a message containing a colon intact", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "colon.txt", "x\n");
    await execGit(repo.root, ["add", "colon.txt"]);
    await stash.push(repo.root, { message: "fix: handle edge case" });

    const [entry] = await stash.listStashes(repo.root);
    expect(entry?.message).toBe("fix: handle edge case");
  });

  it("lists each changed file separately, which git show --name-status does not", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "tracked-a.txt", "a\nb\nc\n");
    await writeRepoFile(repo.root, "tracked-b.txt", "x\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);

    // One staged edit, one unstaged edit: the case where `git show
    // --name-status` collapses statuses onto a single file.
    await writeRepoFile(repo.root, "tracked-a.txt", "a\nCHANGED\nc\n");
    await execGit(repo.root, ["add", "tracked-a.txt"]);
    await writeRepoFile(repo.root, "tracked-b.txt", "x\nunstaged\n");

    await stash.push(repo.root, { message: "Mixed" });
    const { files, indexFiles, hasUntracked } = await stash.listStashFiles(
      repo.root,
      0,
    );

    expect(files.map((f) => f.path).sort()).toEqual([
      "tracked-a.txt",
      "tracked-b.txt",
    ]);
    expect(files.every((f) => f.status === "M")).toBe(true);
    expect(hasUntracked).toBe(false);
    // Only the staged file belongs to the index parent.
    expect(indexFiles.map((f) => f.path)).toEqual(["tracked-a.txt"]);
  });

  it("does not throw for a stash created without --include-untracked", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "only-tracked.txt", "v1\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "only-tracked.txt", "v2\n");
    await writeRepoFile(repo.root, "left-behind.txt", "untracked\n");

    await stash.push(repo.root, { message: "No untracked" });

    // stash@{0}^3 does not exist here; probing it directly would fail.
    await expect(stash.listStashFiles(repo.root, 0)).resolves.toBeTruthy();
    expect(await stash.hasUntrackedParent(repo.root, 0)).toBe(false);
  });

  it("includes untracked files when stashed with includeUntracked", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "base.txt", "v1\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "base.txt", "v2\n");
    await writeRepoFile(repo.root, "brand new.txt", "fresh\n");

    await stash.push(repo.root, { includeUntracked: true, message: "With untracked" });
    const { files, hasUntracked } = await stash.listStashFiles(repo.root, 0);

    expect(hasUntracked).toBe(true);
    const untracked = files.filter((f) => f.origin === "untracked");
    // Path contains a space: proves -z parsing avoids git's quoting.
    expect(untracked.map((f) => f.path)).toEqual(["brand new.txt"]);
    expect(untracked[0]?.status).toBe("A");
  });

  it("detects a rename and reports the original path", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "before.txt", "same content here\nline two\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await execGit(repo.root, ["mv", "before.txt", "after.txt"]);

    await stash.push(repo.root, { message: "Renamed" });
    const { files } = await stash.listStashFiles(repo.root, 0);

    const rename = files.find((f) => f.status === "R");
    expect(rename?.path).toBe("after.txt");
    expect(rename?.oldPath).toBe("before.txt");
  });

  it("builds a split diff document for a tracked file", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "diffme.txt", "a\nb\nc\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "diffme.txt", "a\nCHANGED\nc\n");
    await stash.push(repo.root, { message: "Diff" });

    const doc = await stash.buildStashFileDiff(repo.root, "repo-1", 0, "diffme.txt");

    expect(doc.layout).toBe("split");
    expect(doc.status).toBe("M");
    expect(doc.readOnly).toBe(true);
    expect(doc.left?.text).toBe("a\nb\nc\n");
    expect(doc.right?.text).toBe("a\nCHANGED\nc\n");
  });

  it("builds a one-sided diff for an untracked file", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "seed.txt", "seed\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "fresh.txt", "brand new\n");
    await stash.push(repo.root, { includeUntracked: true, message: "New file" });

    const doc = await stash.buildStashFileDiff(
      repo.root,
      "repo-1",
      0,
      "fresh.txt",
      "untracked",
    );

    expect(doc.status).toBe("A");
    expect(doc.left).toBeNull();
    expect(doc.right?.text).toBe("brand new\n");
  });

  it("keepIndex leaves staged changes in the index", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "keep.txt", "v1\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "keep.txt", "v2\n");
    await execGit(repo.root, ["add", "keep.txt"]);

    await stash.push(repo.root, { message: "Keep", keepIndex: true });

    const { stdout } = await execGit(repo.root, ["diff", "--cached", "--name-only"]);
    expect(stdout.trim()).toBe("keep.txt");
  });

  it("apply with reinstateIndex restores the staged state", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "staged.txt", "v1\n");
    await writeRepoFile(repo.root, "unstaged.txt", "v1\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);

    await writeRepoFile(repo.root, "staged.txt", "v2\n");
    await execGit(repo.root, ["add", "staged.txt"]);
    await writeRepoFile(repo.root, "unstaged.txt", "v2\n");
    await stash.push(repo.root, { message: "Split state" });

    await stash.apply(repo.root, 0, { reinstateIndex: true });

    const { stdout } = await execGit(repo.root, ["diff", "--cached", "--name-only"]);
    expect(stdout.trim()).toBe("staged.txt");
  });

  it("getStashDetail combines metadata with the file lists", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "detail.txt", "v1\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "detail.txt", "v2\n");
    await stash.push(repo.root, { message: "Detail test" });

    const detail = await stash.getStashDetail(repo.root, "repo-1", 0, 1234);

    expect(detail.repoId).toBe("repo-1");
    expect(detail.ref).toBe("stash@{0}");
    expect(detail.message).toBe("Detail test");
    expect(detail.refreshedAt).toBe(1234);
    expect(detail.files.map((f) => f.path)).toEqual(["detail.txt"]);
  });

  it("creates a branch from a stash and consumes the entry", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    await writeRepoFile(repo.root, "branch-me.txt", "v1\n");
    await execGit(repo.root, ["add", "-A"]);
    await execGit(repo.root, ["commit", "-m", "base"]);
    await writeRepoFile(repo.root, "branch-me.txt", "v2\n");
    await stash.push(repo.root, { message: "Branch test" });

    await stash.createBranch(repo.root, 0, "feature/from-stash");

    const { stdout } = await execGit(repo.root, ["branch", "--show-current"]);
    expect(stdout.trim()).toBe("feature/from-stash");
    // `git stash branch` applies then drops, so the entry is gone.
    expect(await stash.listStashes(repo.root)).toHaveLength(0);
  });

  it("clears every stash", async () => {
    repo = await createTempGitRepo();
    const stash = createStashApi(execGit);

    for (const name of ["a.txt", "b.txt"]) {
      await writeRepoFile(repo.root, name, "x\n");
      await execGit(repo.root, ["add", "-A"]);
      await stash.push(repo.root, { message: `stash ${name}` });
    }
    expect(await stash.listStashes(repo.root)).toHaveLength(2);

    await stash.clear(repo.root);

    expect(await stash.listStashes(repo.root)).toHaveLength(0);
  });
});