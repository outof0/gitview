import { describe, expect, it } from "vitest";
import type { GitExecFn } from "../../services/git/types";
import type { LogCommitEntry } from "../../shared/types/log";
import { annotateParentPresence } from "../handlers/logParentPresence";

let shaCounter = 0;

function nextSha(): string {
  shaCounter += 1;
  return shaCounter.toString(16).padStart(40, "0");
}

function commit(parents: string[] = []): LogCommitEntry {
  const id = nextSha();
  return {
    sha: id,
    shortSha: id.slice(0, 7),
    author: "Jane",
    authorEmail: "jane@example.com",
    authorTime: 1,
    subject: "Subject",
    parentShas: parents,
    changedFiles: [],
  };
}

function makeExecGit(stdout = ""): {
  execGit: GitExecFn;
  calls: string[][];
} {
  const calls: string[][] = [];
  const execGit: GitExecFn = (_repoRoot, args) => {
    calls.push(args);
    return Promise.resolve({ stdout, stderr: "" });
  };
  return { execGit, calls };
}

describe("annotateParentPresence", () => {
  it("leaves path-simplified logs untouched", async () => {
    const commits = [commit([nextSha(), nextSha()])];
    const { execGit, calls } = makeExecGit();

    const result = await annotateParentPresence(execGit, "/repo", commits, {
      scope: "path",
    });

    expect(result).toBe(commits);
    expect(calls).toHaveLength(0);
  });

  it("leaves unfiltered repo logs untouched", async () => {
    const commits = [commit([nextSha()])];
    const { execGit, calls } = makeExecGit();

    const result = await annotateParentPresence(execGit, "/repo", commits, {
      scope: "repo",
      filters: { range: "all", limit: 200 },
    });

    expect(result).toBe(commits);
    expect(calls).toHaveLength(0);
  });

  it("marks only the first parent on first-parent logs", async () => {
    const commits = [commit([nextSha(), nextSha()])];
    const { execGit, calls } = makeExecGit();

    const result = await annotateParentPresence(execGit, "/repo", commits, {
      scope: "repo",
      filters: { firstParent: true },
    });

    expect(result[0]?.parentPresent).toEqual([true, false]);
    expect(calls).toHaveLength(0);
  });

  it("marks hidden merge parents as absent for no-merges logs", async () => {
    const firstParent = nextSha();
    const mergeParent = nextSha();
    const commits = [commit([firstParent, mergeParent])];
    const { execGit, calls } = makeExecGit(`${mergeParent}\n`);

    const result = await annotateParentPresence(execGit, "/repo", commits, {
      scope: "repo",
      filters: { noMerges: true },
    });

    expect(result[0]?.parentPresent).toEqual([true, false]);
    expect(calls[0]).toEqual([
      "rev-list",
      "--no-walk",
      "--merges",
      firstParent,
      mergeParent,
    ]);
  });

  it("treats parents as absent when the merge check fails", async () => {
    const execGit: GitExecFn = () => Promise.reject(new Error("git failed"));
    const commits = [commit([nextSha()])];

    const result = await annotateParentPresence(execGit, "/repo", commits, {
      scope: "repo",
      filters: { noMerges: true },
    });

    expect(result[0]?.parentPresent).toEqual([false]);
  });

  it("keeps a parent on the next page when the filtered history contains it", async () => {
    const futureParent = nextSha();
    const child = commit([futureParent]);
    const { execGit, calls } = makeExecGit();
    const filtered = new Set([child.sha, futureParent]);

    const result = await annotateParentPresence(execGit, "/repo", [child], {
      scope: "repo",
      filters: { author: "Jane" },
      loadFilteredShas: () => Promise.resolve(filtered),
    });

    expect(result[0]?.parentPresent).toEqual([true]);
    expect(calls).toHaveLength(0);
  });

  it("marks a parent filtered out of the history absent", async () => {
    const hidden = nextSha();
    const child = commit([hidden]);
    const { execGit } = makeExecGit();
    const filtered = new Set([child.sha]);

    const result = await annotateParentPresence(execGit, "/repo", [child], {
      scope: "repo",
      filters: { author: "Jane" },
      loadFilteredShas: () => Promise.resolve(filtered),
    });

    expect(result[0]?.parentPresent).toEqual([false]);
  });

  it("treats parents as absent when the filtered history scan fails", async () => {
    const child = commit([nextSha()]);
    const { execGit } = makeExecGit();

    const result = await annotateParentPresence(execGit, "/repo", [child], {
      scope: "repo",
      filters: { grep: "fix" },
      loadFilteredShas: () => Promise.resolve(null),
    });

    expect(result[0]?.parentPresent).toEqual([false]);
  });

  it("resolves --follow file history through the filtered set", async () => {
    const inHistory = nextSha();
    const filteredOut = nextSha();
    const child = commit([inHistory, filteredOut]);
    const { execGit, calls } = makeExecGit();
    const filtered = new Set([child.sha, inHistory]);

    const result = await annotateParentPresence(execGit, "/repo", [child], {
      scope: "file",
      loadFilteredShas: () => Promise.resolve(filtered),
    });

    expect(result[0]?.parentPresent).toEqual([true, false]);
    expect(calls).toHaveLength(0);
  });

  it("keeps parentless commits untouched", async () => {
    const parentless = commit();
    const commits = [parentless];
    const { execGit } = makeExecGit();

    const result = await annotateParentPresence(execGit, "/repo", commits, {
      scope: "file",
    });

    expect(result[0]).toBe(parentless);
  });
});
