import { describe, it, expect } from "vitest";
import { LOG_FORMAT } from "../logParser";
import { createGitService } from "../gitService";
import { sampleLogOutput, makeFakeGit } from "./gitService.testHelpers";

describe("GitService logChangesFromSide", () => {
  const logOutput = sampleLogOutput("Fix on feature branch");

  it("logs merge-base..HEAD for ours with optional file filter", async () => {
    const execGit = (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "rev-parse --verify MERGE_HEAD") {
        return Promise.resolve({ stdout: "m\n", stderr: "" });
      }
      if (key === "merge-base HEAD MERGE_HEAD") {
        return Promise.resolve({ stdout: "base\n", stderr: "" });
      }
      if (
        key ===
        `log --name-status --format=${LOG_FORMAT} -n 100 base..HEAD -- src/app.ts`
      ) {
        return Promise.resolve({ stdout: logOutput, stderr: "" });
      }
      return Promise.reject(new Error(`Unexpected: ${key}`));
    };
    const svc = createGitService({ execGit });
    const result = await svc.logChangesFromSide("/repo", "ours", {
      filterPath: "src/app.ts",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revisionRange).toBe("base..HEAD");
      expect(result.commits).toHaveLength(1);
      expect(result.allChangedPaths).toEqual(["src/app.ts"]);
    }
  });

  it("returns NOT_IN_MERGE when MERGE_HEAD is absent", async () => {
    const execGit = () => Promise.reject(new Error("no MERGE_HEAD"));
    const svc = createGitService({ execGit });
    const result = await svc.logChangesFromSide("/repo", "theirs");
    expect(result).toMatchObject({ ok: false, code: "NOT_IN_MERGE" });
  });
});

describe("GitService logFile and logFolder", () => {
  const logOutput = sampleLogOutput("Fix greeting");

  it("logFile parses commit history", async () => {
    const { service } = makeFakeGit({
      [`log --follow --name-status --format=${LOG_FORMAT} -n 100 -- src/app.ts`]:
        {
          stdout: logOutput,
          stderr: "",
        },
    });
    const result = await service.logFile("/repo", "src/app.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0]!.subject).toBe("Fix greeting");
    }
  });

  it("logFolder queries folder path with trailing slash", async () => {
    const { service, calls } = makeFakeGit({
      [`log --name-status --format=${LOG_FORMAT} -n 100 -- src/`]: {
        stdout: logOutput,
        stderr: "",
      },
    });
    const result = await service.logFolder("/repo", "src");
    expect(result.ok).toBe(true);
    expect(calls[0]!.args).toContain("src/");
  });

  it("showCommit includes changed files from name-status output", async () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const { service, calls } = makeFakeGit({
      [`show --format=fuller --no-patch ${sha}`]: {
        stdout: `commit ${sha} (aaaaaaa)
Author: Jane Doe <jane@example.com>
Commit: Jane Doe <jane@example.com>

    Fix build
`,
        stderr: "",
      },
      [`show --format=%b --no-patch ${sha}`]: {
        stdout: "",
        stderr: "",
      },
      [`show --name-status --format= ${sha}`]: {
        stdout: "M\t.gitlab/ci/build.yml\nA\tsrc/new.ts\n",
        stderr: "",
      },
      [`show -s --format=%at ${sha}`]: {
        stdout: "1719000000\n",
        stderr: "",
      },
    });

    const result = await service.showCommit("/repo", sha);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commit.changedFiles).toEqual([
        { path: ".gitlab/ci/build.yml", status: "M" },
        { path: "src/new.ts", status: "A" },
      ]);
    }
    expect(calls.map((call) => call.args.join(" "))).not.toContain(
      `show --name-status --format= --no-patch ${sha}`,
    );
  });
});

describe("GitService fileDiffAtCommit", () => {
  it("returns single panel for added files", async () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const { service } = makeFakeGit({
      [`rev-parse ${sha}^`]: {
        stdout: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
        stderr: "",
      },
      [`show ${sha}:src/new.ts`]: {
        stdout: "export const x = 1;\n",
        stderr: "",
      },
      "diff --numstat -- src/new.ts": {
        stdout: "1\t0\tsrc/new.ts\n",
        stderr: "",
      },
    });
    const result = await service.fileDiffAtCommit(
      "/repo",
      sha,
      "src/new.ts",
      "A",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.layout).toBe("single");
      expect(result.diff.left).toBeNull();
      expect(result.diff.right?.text).toContain("export const x");
    }
  });

  it("returns split panels for modified files", async () => {
    const sha = "cccccccccccccccccccccccccccccccccccccccc";
    const parent = "dddddddddddddddddddddddddddddddddddddddd";
    const { service } = makeFakeGit({
      [`rev-parse ${sha}^`]: { stdout: `${parent}\n`, stderr: "" },
      [`show ${parent}:file.txt`]: { stdout: "old\n", stderr: "" },
      [`show ${sha}:file.txt`]: { stdout: "new\n", stderr: "" },
      "diff --numstat -- file.txt": {
        stdout: "1\t1\tfile.txt\n",
        stderr: "",
      },
    });
    const result = await service.fileDiffAtCommit(
      "/repo",
      sha,
      "file.txt",
      "M",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.layout).toBe("split");
      expect(result.diff.left?.text).toBe("old\n");
      expect(result.diff.right?.text).toBe("new\n");
    }
  });
});