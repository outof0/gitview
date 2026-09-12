import type { BranchEntry } from "../../shared/types/branch";
import type { GitExecFn } from "./types";
import { assertSafeGitOperand } from "../../shared/lib/gitOperand";

export type CheckoutOptions = {
  force?: boolean;
  smart?: boolean;
};

/** What a ref actually points at, resolved through git rather than its spelling. */
export type BranchRefKind = "local" | "remote" | "tag" | "unknown";

export type CreateBranchOptions = {
  /** Switch to the new branch after creating it. Defaults to true. */
  checkout?: boolean;
  /** Reset the branch if it already exists (-B / --force). */
  force?: boolean;
};

export function createBranchApi(execGit: GitExecFn) {
  async function listBranchEntries(
    repoRoot: string,
    repoId: string,
  ): Promise<BranchEntry[]> {
    const { stdout } = await execGit(repoRoot, [
      "for-each-ref",
      "--format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname)|%(HEAD)",
      "refs/heads/",
      "refs/remotes/",
    ]);

    const branches: BranchEntry[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [shortName, fullRef, upstream, headSha, headFlag] =
        trimmed.split("|");
      if (!shortName || !fullRef || shortName.includes("HEAD")) {
        continue;
      }
      const isRemote = fullRef.startsWith("refs/remotes/");
      branches.push({
        repoId,
        name: isRemote ? shortName.split("/").slice(1).join("/") : shortName,
        fullName: shortName,
        remote: isRemote,
        current: headFlag === "*",
        upstream: upstream || null,
        headSha: headSha || null,
      });
    }

    return branches.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async function isDirty(repoRoot: string): Promise<boolean> {
    const { stdout } = await execGit(repoRoot, ["status", "--porcelain"]);
    return stdout.trim().length > 0;
  }

  /**
   * Classify a ref by asking git, not by looking at its spelling.
   *
   * Treating every ref containing "/" as a remote branch is wrong: `feature/login`
   * is an ordinary local branch, and the old heuristic checked it out as a new
   * branch named `login` tracking `feature/login`. Local refs win, because that
   * is what the user means when a local and a remote branch share a name.
   */
  async function resolveRefKind(
    repoRoot: string,
    ref: string,
  ): Promise<BranchRefKind> {
    const candidates: ReadonlyArray<[BranchRefKind, string]> = [
      ["local", `refs/heads/${ref}`],
      ["remote", `refs/remotes/${ref}`],
      ["tag", `refs/tags/${ref}`],
    ];
    for (const [kind, fullRef] of candidates) {
      try {
        await execGit(repoRoot, [
          "show-ref",
          "--verify",
          "--quiet",
          fullRef,
        ]);
        return kind;
      } catch {
        /* not this one */
      }
    }
    return "unknown";
  }

  /**
   * Run a checkout behind smart checkout: stash the pending work first, then
   * restore it afterwards. Shared by the local and remote paths so "smart"
   * means the same thing whichever branch the user picked — remote checkouts
   * used to skip it entirely and silently carried dirty files across branches.
   */
  async function withSmartStash(
    repoRoot: string,
    opts: CheckoutOptions | undefined,
    operation: () => Promise<void>,
  ): Promise<void> {
    if (!opts?.smart || opts?.force || !(await isDirty(repoRoot))) {
      await operation();
      return;
    }

    await execGit(repoRoot, [
      "stash",
      "push",
      "-m",
      "GitView Smart Checkout",
      "--include-untracked",
    ]);
    try {
      await operation();
      await execGit(repoRoot, ["stash", "pop"]);
    } catch (err) {
      throw new Error(
        `Checkout completed but restoring shelved work failed. Run 'git stash pop' to recover. ${err instanceof Error ? err.message : ""}`,
      );
    }
  }

  async function checkout(
    repoRoot: string,
    ref: string,
    opts?: CheckoutOptions,
  ): Promise<void> {
    await withSmartStash(repoRoot, opts, () =>
      checkoutInternal(repoRoot, ref, opts),
    );
  }

  async function checkoutInternal(
    repoRoot: string,
    ref: string,
    opts?: CheckoutOptions,
  ): Promise<void> {
    assertSafeGitOperand(ref, "branch or ref");
    const args = ["switch"];
    if (opts?.force) {
      args.push("-f");
    }
    args.push(ref);
    try {
      await execGit(repoRoot, args);
    } catch {
      const legacy = ["checkout"];
      if (opts?.force) {
        legacy.push("-f");
      }
      legacy.push(ref);
      await execGit(repoRoot, legacy);
    }
  }

  async function checkoutRemoteAsTracking(
    repoRoot: string,
    remoteBranch: string,
    opts?: CheckoutOptions,
  ): Promise<void> {
    assertSafeGitOperand(remoteBranch, "remote branch");
    // `remoteBranch` is a `refs/remotes/<remote>/<branch>` short name, so the
    // first segment is the remote and the rest is the branch to create locally.
    const localName = remoteBranch.includes("/")
      ? remoteBranch.split("/").slice(1).join("/")
      : remoteBranch;
    const switchArgs = ["switch"];
    if (opts?.force) {
      switchArgs.push("-f");
    }
    switchArgs.push("--track", "-c", localName, remoteBranch);

    await withSmartStash(repoRoot, opts, async () => {
      try {
        await execGit(repoRoot, switchArgs);
      } catch {
        const checkoutArgs = ["checkout"];
        if (opts?.force) {
          checkoutArgs.push("-f");
        }
        checkoutArgs.push("--track", "-b", localName, remoteBranch);
        await execGit(repoRoot, checkoutArgs);
      }
    });
  }

  async function createBranch(
    repoRoot: string,
    name: string,
    startPoint?: string,
    opts?: CreateBranchOptions,
  ): Promise<void> {
    assertSafeGitOperand(name, "branch name");
    if (startPoint) {
      assertSafeGitOperand(startPoint, "start point");
    }
    const force = opts?.force ?? false;

    if (opts?.checkout === false) {
      const args = ["branch"];
      if (force) {
        args.push("--force");
      }
      args.push(name);
      if (startPoint) {
        args.push(startPoint);
      }
      await execGit(repoRoot, args);
      return;
    }

    const args = ["switch", force ? "-C" : "-c", name];
    if (startPoint) {
      args.push(startPoint);
    }
    try {
      await execGit(repoRoot, args);
    } catch {
      const legacy = ["checkout", force ? "-B" : "-b", name];
      if (startPoint) {
        legacy.push(startPoint);
      }
      await execGit(repoRoot, legacy);
    }
  }

  async function deleteBranch(
    repoRoot: string,
    name: string,
    force = false,
  ): Promise<void> {
    assertSafeGitOperand(name, "branch name");
    await execGit(repoRoot, ["branch", force ? "-D" : "-d", name]);
  }

  async function renameBranch(
    repoRoot: string,
    oldName: string,
    newName: string,
    currentBranch: string | null,
  ): Promise<void> {
    assertSafeGitOperand(oldName, "old branch name");
    assertSafeGitOperand(newName, "new branch name");
    if (currentBranch === oldName) {
      await execGit(repoRoot, ["branch", "-m", newName]);
      return;
    }
    await execGit(repoRoot, ["branch", "-m", oldName, newName]);
  }

  return {
    listBranchEntries,
    checkout,
    checkoutRemoteAsTracking,
    createBranch,
    deleteBranch,
    renameBranch,
    resolveRefKind,
    isDirty,
  };
}
