import type { BranchEntry } from "../../shared/types/branch";
import type { GitExecFn } from "./types";

export type CheckoutOptions = {
  force?: boolean;
  smart?: boolean;
};

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
      "--format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname:short)|%(HEAD)",
      "refs/heads/",
      "refs/remotes/",
    ]);

    const branches: BranchEntry[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [shortName, fullRef, upstream, headSha, headFlag] = trimmed.split("|");
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

  async function checkout(
    repoRoot: string,
    ref: string,
    opts?: CheckoutOptions,
  ): Promise<void> {
    if (opts?.smart && (await isDirty(repoRoot))) {
      await execGit(repoRoot, [
        "stash",
        "push",
        "-m",
        "GitView Smart Checkout",
        "--include-untracked",
      ]);
      try {
        await checkoutInternal(repoRoot, ref, opts);
        await execGit(repoRoot, ["stash", "pop"]);
      } catch (err) {
        throw new Error(
          `Checkout completed but restoring shelved work failed. Run 'git stash pop' to recover. ${err instanceof Error ? err.message : ""}`,
        );
      }
      return;
    }

    await checkoutInternal(repoRoot, ref, opts);
  }

  async function checkoutInternal(
    repoRoot: string,
    ref: string,
    opts?: CheckoutOptions,
  ): Promise<void> {
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
    const localName = remoteBranch.includes("/")
      ? remoteBranch.split("/").slice(1).join("/")
      : remoteBranch;
    try {
      await execGit(repoRoot, [
        "switch",
        "--track",
        "-c",
        localName,
        remoteBranch,
      ]);
    } catch {
      await execGit(repoRoot, [
        "checkout",
        "--track",
        "-b",
        localName,
        remoteBranch,
      ]);
    }
    if (opts?.smart) {
      // already switched; smart only needed when dirty before switch
    }
  }

  async function createBranch(
    repoRoot: string,
    name: string,
    startPoint?: string,
    opts?: CreateBranchOptions,
  ): Promise<void> {
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
    await execGit(repoRoot, ["branch", force ? "-D" : "-d", name]);
  }

  async function renameBranch(
    repoRoot: string,
    oldName: string,
    newName: string,
    currentBranch: string | null,
  ): Promise<void> {
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
    isDirty,
  };
}