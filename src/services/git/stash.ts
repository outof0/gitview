import type {
  StashDetail,
  StashEntry,
  StashFileEntry,
  StashFileOrigin,
  StashFileStatus,
} from "../../shared/types/stash";
import type { WorkspaceDiffDocument } from "../../shared/types/diff";
import type { GitExecFn } from "./types";

/** Parses the `%gs` reflog subject: "WIP on main: 1234abc msg" / "On main: msg". */
const STASH_SUBJECT_RE =
  /^(?:WIP on|On)\s+([^:]+):\s*(?:([0-9a-f]{7,40})\s+)?(.*)$/i;

const NUL = "\0";

export type StashPushOptions = {
  message?: string;
  paths?: string[];
  includeUntracked?: boolean;
  /** Leaves already-staged changes in the index. Still clears the worktree. */
  keepIndex?: boolean;
};

export type StashApplyOptions = {
  /** Restores the staged/unstaged split instead of applying everything unstaged. */
  reinstateIndex?: boolean;
};

function stashRef(index: number): string {
  return `stash@{${index}}`;
}

function normalizeStatus(raw: string): StashFileStatus {
  const letter = raw.charAt(0).toUpperCase();
  switch (letter) {
    case "A":
    case "M":
    case "D":
    case "R":
    case "C":
    case "T":
    case "U":
      return letter;
    default:
      return "M";
  }
}

/**
 * Parses `git diff --name-status -z` output.
 *
 * `-z` is required: without it Git quotes paths containing spaces or non-ASCII
 * characters. The format is `status\0path\0` per entry, except renames and
 * copies which emit three fields (`R100\0old\0new\0`), so those consume an
 * extra path.
 */
export function parseNameStatusZ(
  stdout: string,
  origin: StashFileOrigin,
): StashFileEntry[] {
  const fields = stdout.split(NUL);
  const entries: StashFileEntry[] = [];
  let i = 0;
  while (i < fields.length) {
    const rawStatus = fields[i];
    if (!rawStatus) {
      i += 1;
      continue;
    }
    const status = normalizeStatus(rawStatus);
    const isRenameOrCopy = status === "R" || status === "C";
    if (isRenameOrCopy) {
      const oldPath = fields[i + 1];
      const newPath = fields[i + 2];
      if (!oldPath || !newPath) {
        break;
      }
      entries.push({ path: newPath, oldPath, status, origin });
      i += 3;
      continue;
    }
    const path = fields[i + 1];
    if (!path) {
      break;
    }
    entries.push({ path, oldPath: null, status, origin });
    i += 2;
  }
  return entries;
}

export function createStashApi(execGit: GitExecFn) {
  async function listStashes(repoRoot: string): Promise<StashEntry[]> {
    // NUL-delimited so a stash message containing ":" cannot corrupt parsing.
    const { stdout } = await execGit(repoRoot, [
      "stash",
      "list",
      "--format=%gd%x00%gs%x00%H%x00%aI%x00%ar",
    ]);
    const stashes: StashEntry[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [selector, subject, sha, authoredAt, relativeDate] =
        trimmed.split(NUL);
      const index = Number.parseInt(
        selector?.match(/stash@\{(\d+)\}/)?.[1] ?? "",
        10,
      );
      const resolvedIndex = Number.isNaN(index) ? stashes.length : index;
      const subjectMatch = (subject ?? "").match(STASH_SUBJECT_RE);
      const branch = subjectMatch?.[1]?.trim() ?? null;
      const message =
        subjectMatch?.[3]?.trim() ||
        (subject ?? "").trim() ||
        (branch ? `WIP on ${branch}` : trimmed);
      stashes.push({
        index: resolvedIndex,
        ref: stashRef(resolvedIndex),
        branch,
        message,
        sha: sha?.trim() || null,
        authoredAt: authoredAt?.trim() || null,
        relativeDate: relativeDate?.trim() || null,
      });
    }
    return stashes;
  }

  /**
   * A stash has an untracked-files parent (`^3`) only when it was created with
   * `--include-untracked`. Probing `^3` when absent fails, so callers must gate
   * on this instead.
   */
  async function hasUntrackedParent(
    repoRoot: string,
    index: number,
  ): Promise<boolean> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "rev-list",
        "--parents",
        "-n",
        "1",
        stashRef(index),
      ]);
      // self + 3 parents
      return stdout.trim().split(/\s+/).filter(Boolean).length >= 4;
    } catch {
      return false;
    }
  }

  async function listStashFiles(
    repoRoot: string,
    index: number,
  ): Promise<{
    files: StashFileEntry[];
    indexFiles: StashFileEntry[];
    hasUntracked: boolean;
  }> {
    const ref = stashRef(index);
    // `git show --name-status <stash>` is wrong for stashes (they are merge
    // commits); diffing against the base parent is the correct form.
    const [trackedOut, indexOut, hasUntracked] = await Promise.all([
      execGit(repoRoot, [
        "diff",
        "--name-status",
        "-z",
        "-M",
        `${ref}^1`,
        ref,
      ]),
      execGit(repoRoot, [
        "diff",
        "--name-status",
        "-z",
        "-M",
        `${ref}^1`,
        `${ref}^2`,
      ]).catch(() => ({ stdout: "", stderr: "" })),
      hasUntrackedParent(repoRoot, index),
    ]);

    const files = parseNameStatusZ(trackedOut.stdout, "tracked");
    const indexFiles = parseNameStatusZ(indexOut.stdout, "index");

    if (hasUntracked) {
      const { stdout } = await execGit(repoRoot, [
        "ls-tree",
        "-r",
        "-z",
        "--name-only",
        `${ref}^3`,
      ]);
      for (const path of stdout.split(NUL)) {
        if (path) {
          files.push({ path, oldPath: null, status: "A", origin: "untracked" });
        }
      }
    }

    return { files, indexFiles, hasUntracked };
  }

  async function getStashDetail(
    repoRoot: string,
    repoId: string,
    index: number,
    now: number,
  ): Promise<StashDetail> {
    const [entries, fileInfo] = await Promise.all([
      listStashes(repoRoot),
      listStashFiles(repoRoot, index),
    ]);
    const entry = entries.find((candidate) => candidate.index === index);
    return {
      repoId,
      index,
      ref: stashRef(index),
      sha: entry?.sha ?? null,
      branch: entry?.branch ?? null,
      message: entry?.message ?? stashRef(index),
      authoredAt: entry?.authoredAt ?? null,
      hasUntracked: fileInfo.hasUntracked,
      files: fileInfo.files,
      indexFiles: fileInfo.indexFiles,
      refreshedAt: now,
    };
  }

  /** Returns null when the blob does not exist on that side (added/deleted). */
  async function readStashBlob(
    repoRoot: string,
    index: number,
    path: string,
    side: "before" | "after" | "untracked",
  ): Promise<string | null> {
    const ref = stashRef(index);
    const spec =
      side === "before"
        ? `${ref}^1:${path}`
        : side === "untracked"
          ? `${ref}^3:${path}`
          : `${ref}:${path}`;
    try {
      const { stdout } = await execGit(repoRoot, ["show", spec]);
      return stdout;
    } catch {
      return null;
    }
  }

  async function isBinaryInStash(
    repoRoot: string,
    index: number,
    path: string,
  ): Promise<boolean> {
    const ref = stashRef(index);
    try {
      const { stdout } = await execGit(repoRoot, [
        "diff",
        "--numstat",
        "-z",
        `${ref}^1`,
        ref,
        "--",
        path,
      ]);
      return stdout.trim().startsWith("-\t-");
    } catch {
      return false;
    }
  }

  async function buildStashFileDiff(
    repoRoot: string,
    repoId: string,
    index: number,
    path: string,
    origin: StashFileOrigin = "tracked",
  ): Promise<WorkspaceDiffDocument> {
    const ref = stashRef(index);
    const untracked = origin === "untracked";

    if (!untracked && (await isBinaryInStash(repoRoot, index, path))) {
      return {
        repoId,
        filePath: path,
        layout: "single",
        status: "M",
        left: null,
        right: { label: ref, text: "[Binary file]" },
        binary: true,
        staged: false,
        readOnly: true,
      };
    }

    const before = untracked
      ? null
      : await readStashBlob(repoRoot, index, path, "before");
    const after = await readStashBlob(
      repoRoot,
      index,
      path,
      untracked ? "untracked" : "after",
    );

    const status: WorkspaceDiffDocument["status"] =
      before === null ? "A" : after === null ? "D" : "M";

    return {
      repoId,
      filePath: path,
      layout: "split",
      status,
      left: before === null ? null : { label: `${ref}^ (base)`, text: before },
      right: after === null ? null : { label: ref, text: after },
      binary: false,
      staged: false,
      readOnly: true,
    };
  }

  async function push(
    repoRoot: string,
    opts?: StashPushOptions,
  ): Promise<void> {
    const args = ["stash", "push"];
    if (opts?.message?.trim()) {
      args.push("-m", opts.message.trim());
    }
    if (opts?.includeUntracked) {
      args.push("-u");
    }
    if (opts?.keepIndex) {
      args.push("--keep-index");
    }
    if (opts?.paths && opts.paths.length > 0) {
      args.push("--", ...opts.paths);
    }
    await execGit(repoRoot, args);
  }

  async function apply(
    repoRoot: string,
    index = 0,
    opts?: StashApplyOptions,
  ): Promise<void> {
    const args = ["stash", "apply"];
    if (opts?.reinstateIndex) {
      args.push("--index");
    }
    args.push(stashRef(index));
    await execGit(repoRoot, args);
  }

  async function pop(
    repoRoot: string,
    index = 0,
    opts?: StashApplyOptions,
  ): Promise<void> {
    const args = ["stash", "pop"];
    if (opts?.reinstateIndex) {
      args.push("--index");
    }
    args.push(stashRef(index));
    await execGit(repoRoot, args);
  }

  async function drop(repoRoot: string, index = 0): Promise<void> {
    await execGit(repoRoot, ["stash", "drop", stashRef(index)]);
  }

  /** Creates a branch at the stash's base commit and applies the stash there. */
  async function createBranch(
    repoRoot: string,
    index: number,
    branch: string,
  ): Promise<void> {
    await execGit(repoRoot, ["stash", "branch", branch, stashRef(index)]);
  }

  async function clear(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["stash", "clear"]);
  }

  return {
    listStashes,
    listStashFiles,
    getStashDetail,
    buildStashFileDiff,
    readStashBlob,
    hasUntrackedParent,
    push,
    apply,
    pop,
    drop,
    createBranch,
    clear,
  };
}
