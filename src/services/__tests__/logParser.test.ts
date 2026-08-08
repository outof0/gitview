import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import * as path from "path";
import {
  LOG_FORMAT,
  LOG_RECORD_END,
  LOG_RECORD_MARKER,
  parseGitLogWithNameStatus,
  parseShowCommitOutput,
} from "../logParser";

describe("parseGitLogWithNameStatus", () => {
  it("parses commit records with changed files", () => {
    // Matches LOG_FORMAT: subject, parents (%P), decorate (%D), body (%b).
    const output = `${LOG_RECORD_MARKER}
abc1234567890123456789012345678901234567890
abc1234
John Doe
john@example.com
1719000000
Fix greeting
1111111111111111111111111111111111111111
HEAD -> master, origin/master
Body line

${LOG_RECORD_END}
M\tsrc/app.ts
${LOG_RECORD_MARKER}
def4567890123456789012345678901234567890
def4567
Alice Smith
alice@example.com
1718000000
Refactor util
abc1234567890123456789012345678901234567890


${LOG_RECORD_END}
A\tsrc/new.ts
`;

    const commits = parseGitLogWithNameStatus(output);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      sha: "abc1234567890123456789012345678901234567890",
      shortSha: "abc1234",
      author: "John Doe",
      subject: "Fix greeting",
      body: "Body line",
      refs: ["master", "origin/master"],
      changedFiles: [{ path: "src/app.ts", status: "M" }],
    });
    expect(commits[1]!.changedFiles).toEqual([
      { path: "src/new.ts", status: "A" },
    ]);
    expect(commits[0]!.parentShas).toEqual([
      "1111111111111111111111111111111111111111",
    ]);
    expect(commits[0]!.isMerge).toBe(false);
  });

  it("parses real git log output using LOG_FORMAT", () => {
    const repoRoot = path.join(process.cwd(), "test-conflict-repo");
    const stdout = execFileSync(
      "git",
      ["-C", repoRoot, "log", "-1", "--name-status", `--format=${LOG_FORMAT}`],
      { encoding: "utf8" },
    );
    const commits = parseGitLogWithNameStatus(stdout);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]?.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(commits[0]?.parentShas?.length).toBeGreaterThan(0);
    expect(commits[0]?.changedFiles.length).toBeGreaterThan(0);
  });
});

describe("parseShowCommitOutput", () => {
  it("parses git show fuller output", () => {
    const sha = "a".repeat(40);
    const meta = `commit ${sha} (abc1234)
Author: John Doe <john@example.com>
Commit: John Doe <john@example.com>

    Fix greeting
`;
    const body = "Detailed body\n";
    const nameStatus = "M\tsrc/app.ts\n";
    const commit = parseShowCommitOutput(meta, body, nameStatus, "1719000000");
    expect(commit).toMatchObject({
      sha,
      shortSha: "abc1234",
      author: "John Doe",
      authorEmail: "john@example.com",
      authorTime: 1719000000,
      subject: "Fix greeting",
      body: "Detailed body",
      changedFiles: [{ path: "src/app.ts", status: "M" }],
    });
  });
});
