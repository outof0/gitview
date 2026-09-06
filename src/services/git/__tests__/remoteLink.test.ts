import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { GitExecFn } from "../types";
import { execGit as realExecGit } from "../../../test/helpers/tempGitRepo";
import {
  getCurrentBranch,
  getHeadSha,
  isBranchOnRemote,
  getRemoteUrl,
  isShaOnRemote,
  resolveRemoteLinkContext,
} from "../remoteLink";

function stubExecGit(responses: Record<string, string>): GitExecFn {
  return async (_repoRoot, args) => {
    const key = args.join(" ");
    if (key in responses) {
      return { stdout: responses[key]!, stderr: "" };
    }
    throw new Error(`no remote: ${key}`);
  };
}

describe("getRemoteUrl", () => {
  it("returns the trimmed remote url", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git\n",
    });
    await expect(getRemoteUrl(execGit, "/repo", "origin")).resolves.toBe(
      "git@github.com:o/r.git",
    );
  });

  it("returns null when the remote is missing", async () => {
    const execGit = stubExecGit({});
    await expect(getRemoteUrl(execGit, "/repo", "origin")).resolves.toBeNull();
  });

  it("returns null for blank output", async () => {
    const execGit = stubExecGit({ "remote get-url origin": "  \n" });
    await expect(getRemoteUrl(execGit, "/repo", "origin")).resolves.toBeNull();
  });
});

describe("getHeadSha", () => {
  it("accepts full shas only", async () => {
    const execGit = stubExecGit({ "rev-parse HEAD": `${"a".repeat(40)}\n` });
    await expect(getHeadSha(execGit, "/repo")).resolves.toBe("a".repeat(40));
  });

  it("rejects short shas and failures", async () => {
    const short = stubExecGit({ "rev-parse HEAD": "abc1234\n" });
    await expect(getHeadSha(short, "/repo")).resolves.toBeNull();
    await expect(getHeadSha(stubExecGit({}), "/repo")).resolves.toBeNull();
  });
});

describe("getCurrentBranch", () => {
  it("returns the trimmed branch name", async () => {
    const execGit = stubExecGit({ "branch --show-current": "main\n" });
    await expect(getCurrentBranch(execGit, "/repo")).resolves.toBe("main");
  });

  it("returns null on detached head", async () => {
    const execGit = stubExecGit({ "branch --show-current": "\n" });
    await expect(getCurrentBranch(execGit, "/repo")).resolves.toBeNull();
  });

  it("returns null when git fails", async () => {
    await expect(
      getCurrentBranch(stubExecGit({}), "/repo"),
    ).resolves.toBeNull();
  });
});

describe("isShaOnRemote", () => {
  it("detects pushed shas on the selected remote only", async () => {
    const pushed = stubExecGit({
      "branch -r --contains abc --format=%(refname)":
        "refs/remotes/origin/main\n",
    });
    await expect(isShaOnRemote(pushed, "/repo", "abc", "origin")).resolves.toBe(
      true,
    );
    // Present on `upstream` but not on `origin`: not pushed for origin links.
    const otherRemote = stubExecGit({
      "branch -r --contains abc --format=%(refname)":
        "refs/remotes/upstream/main\n",
    });
    await expect(
      isShaOnRemote(otherRemote, "/repo", "abc", "origin"),
    ).resolves.toBe(false);
    // A remote whose name merely extends the selected one must not match.
    const prefixTrap = stubExecGit({
      "branch -r --contains abc --format=%(refname)":
        "refs/remotes/origin2/main\n",
    });
    await expect(
      isShaOnRemote(prefixTrap, "/repo", "abc", "origin"),
    ).resolves.toBe(false);
    const local = stubExecGit({
      "branch -r --contains abc --format=%(refname)": "\n",
    });
    await expect(isShaOnRemote(local, "/repo", "abc", "origin")).resolves.toBe(
      false,
    );
  });

  it("returns false when git fails", async () => {
    await expect(
      isShaOnRemote(stubExecGit({}), "/repo", "abc", "origin"),
    ).resolves.toBe(false);
  });
});

describe("isBranchOnRemote", () => {
  it("matches only the exact branch on the selected remote", async () => {
    const execGit = stubExecGit({
      "for-each-ref --format=%(refname) refs/remotes/origin":
        "refs/remotes/origin/feature/one\nrefs/remotes/origin2/feature/two\n",
    });
    await expect(
      isBranchOnRemote(execGit, "/repo", "feature/one", "origin"),
    ).resolves.toBe(true);
    await expect(
      isBranchOnRemote(execGit, "/repo", "feature/two", "origin"),
    ).resolves.toBe(false);
  });
});

describe("resolveRemoteLinkContext", () => {
  const sha = "a".repeat(40);

  it("pins the commit sha when it is pushed (auto)", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "main",
      [`branch -r --contains ${sha} --format=%(refname)`]: "refs/remotes/origin/main\n",
    });
    await expect(
      resolveRemoteLinkContext(execGit, "/repo", "origin", "auto"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: { type: "commit", sha },
    });
  });

  it("returns no path ref when both the sha and branch are local-only (auto)", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "feature",
    });
    const execLocal: GitExecFn = async (root, args, opts) => {
      if (args[0] === "branch" && args[1] === "-r") {
        return { stdout: "", stderr: "" };
      }
      return execGit(root, args, opts);
    };
    await expect(
      resolveRemoteLinkContext(execLocal, "/repo", "origin", "auto"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: null,
    });
  });

  it("uses the branch in auto mode when that exact branch exists remotely", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "feature",
      [`branch -r --contains ${sha} --format=%(refname)`]: "",
      "for-each-ref --format=%(refname) refs/remotes/origin":
        "refs/remotes/origin/feature\n",
    });
    await expect(
      resolveRemoteLinkContext(execGit, "/repo", "origin", "auto"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: { type: "branch", name: "feature" },
    });
  });

  it("returns null without a remote url", async () => {
    await expect(
      resolveRemoteLinkContext(stubExecGit({}), "/repo", "origin", "auto"),
    ).resolves.toBeNull();
  });

  it("forces the commit sha in commit mode", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "main",
    });
    await expect(
      resolveRemoteLinkContext(execGit, "/repo", "origin", "commit"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: { type: "commit", sha },
    });
  });

  it("falls back to the branch in commit mode without a sha", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "branch --show-current": "main",
    });
    const noHead: GitExecFn = async (root, args, opts) => {
      if (args[0] === "rev-parse") {
        throw new Error("unborn HEAD");
      }
      return execGit(root, args, opts);
    };
    await expect(
      resolveRemoteLinkContext(noHead, "/repo", "origin", "commit"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: { type: "branch", name: "main" },
    });
  });

  it("forces the branch in branch mode", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "main",
      [`branch -r --contains ${sha} --format=%(refname)`]: "refs/remotes/origin/main\n",
    });
    await expect(
      resolveRemoteLinkContext(execGit, "/repo", "origin", "branch"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: { type: "branch", name: "main" },
    });
  });

  it("falls back to the sha in branch mode on detached head", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "",
    });
    await expect(
      resolveRemoteLinkContext(execGit, "/repo", "origin", "branch"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: { type: "commit", sha },
    });
  });

  it("returns null when neither sha nor branch exists", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "branch --show-current": "",
    });
    const empty: GitExecFn = async (root, args, opts) => {
      if (args[0] === "rev-parse") {
        throw new Error("unborn HEAD");
      }
      return execGit(root, args, opts);
    };
    await expect(
      resolveRemoteLinkContext(empty, "/repo", "origin", "auto"),
    ).resolves.toBeNull();
  });

  it("scopes auto-mode reachability to the selected remote", async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-remotes-"));
    try {
      const originBare = path.join(parent, "origin.git");
      const upstreamBare = path.join(parent, "upstream.git");
      await fs.mkdir(originBare);
      await fs.mkdir(upstreamBare);
      const realGit = realExecGit;
      await realGit(originBare, ["init", "--bare"]);
      await realGit(upstreamBare, ["init", "--bare"]);

      const work = path.join(parent, "work");
      await fs.mkdir(work);
      await realGit(work, ["init", "-b", "main"]);
      await realGit(work, ["config", "user.email", "test@example.com"]);
      await realGit(work, ["config", "user.name", "Test"]);
      await fs.writeFile(path.join(work, "file.txt"), "content\n");
      await realGit(work, ["add", "file.txt"]);
      await realGit(work, ["commit", "-m", "Work"]);
      await realGit(work, ["remote", "add", "origin", originBare]);
      await realGit(work, ["remote", "add", "upstream", upstreamBare]);
      // Pushed to upstream only: origin has never seen this commit.
      await realGit(work, ["push", "upstream", "main"]);

      const { stdout: sha } = await realGit(work, ["rev-parse", "HEAD"]);
      const commit = sha.trim();
      await expect(
        isShaOnRemote(realGit, work, commit, "upstream"),
      ).resolves.toBe(true);
      await expect(
        isShaOnRemote(realGit, work, commit, "origin"),
      ).resolves.toBe(false);

      // Auto mode for origin must fall back to the branch, not emit an
      // origin commit URL that would 404.
      const originCtx = await resolveRemoteLinkContext(
        realGit,
        work,
        "origin",
        "auto",
      );
      expect(originCtx?.ref).toBeNull();
      const upstreamCtx = await resolveRemoteLinkContext(
        realGit,
        work,
        "upstream",
        "auto",
      );
      expect(upstreamCtx?.ref).toEqual({ type: "commit", sha: commit });
    } finally {
      await fs.rm(parent, { recursive: true, force: true });
    }
  });

  it("returns no path ref for an unpushed detached HEAD in auto mode", async () => {
    const execGit = stubExecGit({
      "remote get-url origin": "git@github.com:o/r.git",
      "rev-parse HEAD": sha,
      "branch --show-current": "",
    });
    const execLocal: GitExecFn = async (root, args, opts) => {
      if (args[0] === "branch" && args[1] === "-r") {
        return { stdout: "", stderr: "" };
      }
      return execGit(root, args, opts);
    };
    await expect(
      resolveRemoteLinkContext(execLocal, "/repo", "origin", "auto"),
    ).resolves.toEqual({
      remoteUrl: "git@github.com:o/r.git",
      ref: null,
    });
  });
});
