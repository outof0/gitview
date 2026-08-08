import { describe, expect, it, afterEach } from "vitest";
import { createLinePatchApi } from "../git/linePatch";
import { createStatusApi } from "../git/status";
import {
  createTempGitRepo,
  execGit,
  writeRepoFile,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

describe("linePatch integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    await repo?.cleanup();
    repo = null;
  });

  it("stages only the selected changed lines", async () => {
    repo = await createTempGitRepo();
    const linePatch = createLinePatchApi(execGit);
    const statusApi = createStatusApi(execGit);

    const lines = ["line1", "line2", "line3", "line4", "line5"];
    await writeRepoFile(repo.root, "sample.txt", `${lines.join("\n")}\n`);
    await execGit(repo.root, ["add", "sample.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add sample"]);

    const edited = [
      "line1",
      "line2-changed",
      "line3",
      "line4-changed",
      "line5",
    ];
    await writeRepoFile(repo.root, "sample.txt", `${edited.join("\n")}\n`);

    await linePatch.stageLines(repo.root, "sample.txt", [
      { side: "new", line: 2 },
    ]);

    const status = await statusApi.getStatus(repo.root, "repo-1");
    const file = status.files.find((f) => f.path === "sample.txt");
    expect(file?.staged).toBe(true);

    const { stdout } = await execGit(repo.root, [
      "diff",
      "--cached",
      "HEAD",
      "--",
      "sample.txt",
    ]);
    expect(stdout).toContain("line2-changed");
    expect(stdout).not.toContain("line4-changed");

    const { stdout: working } = await execGit(repo.root, [
      "diff",
      "HEAD",
      "--",
      "sample.txt",
    ]);
    expect(working).toContain("line4-changed");
  });

  it("unstages only the selected staged lines", async () => {
    repo = await createTempGitRepo();
    const linePatch = createLinePatchApi(execGit);

    const lines = ["line1", "line2", "line3", "line4", "line5"];
    await writeRepoFile(repo.root, "sample.txt", `${lines.join("\n")}\n`);
    await execGit(repo.root, ["add", "sample.txt"]);
    await execGit(repo.root, ["commit", "-m", "Add sample"]);

    const edited = [
      "line1",
      "line2-changed",
      "line3",
      "line4-changed",
      "line5",
    ];
    await writeRepoFile(repo.root, "sample.txt", `${edited.join("\n")}\n`);
    await execGit(repo.root, ["add", "sample.txt"]);

    await linePatch.unstageLines(repo.root, "sample.txt", [
      { side: "new", line: 4 },
    ]);

    const { stdout: staged } = await execGit(repo.root, [
      "diff",
      "--cached",
      "HEAD",
      "--",
      "sample.txt",
    ]);
    expect(staged).toContain("line2-changed");
    expect(staged).not.toContain("line4-changed");
  });
});