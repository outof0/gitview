import * as fs from "fs/promises";
import * as path from "path";
import type { BranchCompareFile, BranchCompareMode } from "../../shared/types/branch";
import type { WorkspaceDiffDocument } from "../../shared/types/diff";
import { assertSafeGitOperand } from "../../shared/lib/gitOperand";
import { isValidRepoRelativePath } from "../blameRefs";
import {
  replaceFileAtomically,
  unlinkInsideRepo,
  writeBufferAtomically,
} from "../fileService";
import { resolveRepoParentRealPath } from "../../util/repoPath";
import { stripGitConflictMarkers } from "../../util/stripGitConflictMarkers";
import type { GitExecFn } from "./types";

/**
 * Repository-bound atomic write used for branch content.
 *
 * Implemented centrally in the file service: a uniquely-named temporary file
 * plus `rename` replaces a hostile final-component symlink instead of
 * following it, while the parent directory is containment-checked immediately
 * before both temporary-file creation and the rename.
 */
export async function writeFileAtomically(
  repoRoot: string,
  destPath: string,
  data: Buffer,
): Promise<void> {
  await writeBufferAtomically(repoRoot, destPath, data);
}

function parseNameStatus(stdout: string): BranchCompareFile[] {
  const files: BranchCompareFile[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^([ADMRTU])\d*\t(.+)$/);
    if (!match) {
      continue;
    }
    const status = match[1]!;
    const filePath = match[2]!;
    if (status === "A" || status === "D" || status === "M" || status === "R") {
      files.push({ path: filePath, status });
    } else {
      files.push({ path: filePath, status: "M" });
    }
  }
  return files;
}

async function readBlobAtRef(
  execGit: GitExecFn,
  repoRoot: string,
  ref: string,
  relativePath: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, ["show", `${ref}:${relativePath}`]);
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Same blob as `readBlobAtRef`, but as raw bytes.
 *
 * `readBlobAtRef` decodes stdout as UTF-8, which replaces every byte that is not
 * valid UTF-8 with U+FFFD. Writing that string back to disk produces a file that
 * differs from the blob — silently corrupting any binary the user applies from a
 * branch. Always use this when the content is going back to disk.
 *
 * Git failures propagate: distinguishing "the ref lacks the path" from "git
 * could not answer" is the caller's job, because only the caller knows whether
 * a null answer would delete something.
 */
async function readBlobBytesAtRef(
  execGit: GitExecFn,
  repoRoot: string,
  ref: string,
  relativePath: string,
): Promise<Buffer | null> {
  const { stdoutBuffer } = await execGit(
    repoRoot,
    ["show", `${ref}:${relativePath}`],
    { encoding: "buffer" },
  );
  return stdoutBuffer ?? null;
}

async function readWorktreeFile(
  repoRoot: string,
  relativePath: string,
): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    return stripGitConflictMarkers(raw);
  } catch {
    return null;
  }
}

export type TreeEntryAtRef = {
  /** Git file mode: `100644`, `100755`, `120000`, or `160000`. */
  mode: string;
  /** Object type: `blob`, or `commit` for a gitlink (submodule). */
  kind: string;
  sha: string;
};

/**
 * Read the tree entry (mode + type) for `relativePath` at `ref`.
 *
 * Returns null on positive proof of absence: `git ls-tree` exits 0 with no
 * output for a missing path but fails for a broken ref. Anything that
 * deletes a working-tree file must confirm absence here first, because a
 * failed read alone means "absent OR git could not answer".
 */
async function readTreeEntryAtRef(
  execGit: GitExecFn,
  repoRoot: string,
  ref: string,
  relativePath: string,
): Promise<TreeEntryAtRef | null> {
  const { stdout } = await execGit(repoRoot, [
    "ls-tree",
    ref,
    "--",
    relativePath,
  ]);
  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  if (!line) {
    return null;
  }
  const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t/);
  if (!match?.[1] || !match?.[2] || !match?.[3]) {
    throw new Error(`Could not parse ls-tree output for ${relativePath}.`);
  }
  return { mode: match[1], kind: match[2], sha: match[3] };
}

function mapFileStatus(
  status: BranchCompareFile["status"],
): WorkspaceDiffDocument["status"] {
  return status;
}

export function createBranchCompareApi(
  execGit: GitExecFn,
  _isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
  async function isBinaryComparison(
    repoRoot: string,
    left: string,
    relativePath: string,
  ): Promise<boolean> {
    const { stdout } = await execGit(repoRoot, [
      "diff",
      "--numstat",
      left,
      "--",
      relativePath,
    ]);
    return stdout.split("\n").some((line) => line.startsWith("-\t-\t"));
  }

  async function currentBranchRef(repoRoot: string): Promise<string> {
    try {
      const { stdout } = await execGit(repoRoot, ["branch", "--show-current"]);
      const name = stdout.trim();
      return name || "HEAD";
    } catch {
      return "HEAD";
    }
  }

  async function listCompareWithCurrent(
    repoRoot: string,
    selectedRef: string,
  ): Promise<BranchCompareFile[]> {
    const current = await currentBranchRef(repoRoot);
    const { stdout } = await execGit(repoRoot, [
      "diff",
      "--name-status",
      `${current}...${selectedRef}`,
    ]);
    return parseNameStatus(stdout);
  }

  async function listCompareWithWorkingTree(
    repoRoot: string,
    selectedRef: string,
  ): Promise<BranchCompareFile[]> {
    const { stdout } = await execGit(repoRoot, [
      "diff",
      "--name-status",
      selectedRef,
    ]);
    return parseNameStatus(stdout);
  }

  async function listFiles(
    repoRoot: string,
    selectedRef: string,
    mode: BranchCompareMode,
  ): Promise<BranchCompareFile[]> {
    return mode === "current"
      ? listCompareWithCurrent(repoRoot, selectedRef)
      : listCompareWithWorkingTree(repoRoot, selectedRef);
  }

  async function buildCompareWithCurrentDocument(
    repoRoot: string,
    repoId: string,
    relativePath: string,
    selectedRef: string,
    fileStatus?: BranchCompareFile["status"],
  ): Promise<WorkspaceDiffDocument | null> {
    if (!isValidRepoRelativePath(relativePath)) {
      return null;
    }

    const current = await currentBranchRef(repoRoot);
    const currentLabel = current === "HEAD" ? "HEAD" : current;
    const selectedLabel =
      selectedRef.length > 24 ? `${selectedRef.slice(0, 7)}…` : selectedRef;
    const status = fileStatus ?? "M";
    const binary = await isBinaryComparison(
      repoRoot,
      `${current}...${selectedRef}`,
      relativePath,
    );

    if (binary) {
      return {
        repoId,
        filePath: relativePath,
        layout: status === "A" || status === "D" ? "single" : "split",
        status,
        left: { label: currentLabel, text: "[Binary file]" },
        right: { label: selectedLabel, text: "[Binary file]" },
        binary: true,
        staged: false,
        readOnly: true,
        compareMode: "branchCurrent",
      };
    }

    const leftText =
      status === "A"
        ? ""
        : ((await readBlobAtRef(execGit, repoRoot, current, relativePath)) ?? "");
    const rightText =
      status === "D"
        ? ""
        : ((await readBlobAtRef(execGit, repoRoot, selectedRef, relativePath)) ?? "");

    return {
      repoId,
      filePath: relativePath,
      layout: status === "A" || status === "D" ? "single" : "split",
      status: mapFileStatus(status),
      left: {
        label: status === "A" ? "Empty" : currentLabel,
        text: leftText,
      },
      right: {
        label: status === "D" ? "Deleted" : selectedLabel,
        text: rightText,
      },
      binary: false,
      staged: false,
      readOnly: true,
      compareMode: "branchCurrent",
    };
  }

  async function buildCompareWithWorkingTreeDocument(
    repoRoot: string,
    repoId: string,
    relativePath: string,
    selectedRef: string,
    fileStatus?: BranchCompareFile["status"],
  ): Promise<WorkspaceDiffDocument | null> {
    if (!isValidRepoRelativePath(relativePath)) {
      return null;
    }

    const selectedLabel =
      selectedRef.length > 24 ? `${selectedRef.slice(0, 7)}…` : selectedRef;
    const status = fileStatus ?? "M";
    const binary = await isBinaryComparison(repoRoot, selectedRef, relativePath);

    if (binary) {
      return {
        repoId,
        filePath: relativePath,
        layout: status === "A" || status === "D" ? "single" : "split",
        status,
        left: { label: selectedLabel, text: "[Binary file]" },
        right: { label: "Working Tree", text: "[Binary file]" },
        binary: true,
        staged: false,
        readOnly: true,
        compareMode: "branchWorkingTree",
      };
    }

    const leftText =
      status === "A"
        ? ""
        : ((await readBlobAtRef(execGit, repoRoot, selectedRef, relativePath)) ?? "");
    const rightText =
      status === "D"
        ? ""
        : ((await readWorktreeFile(repoRoot, relativePath)) ?? "");

    return {
      repoId,
      filePath: relativePath,
      layout: status === "A" || status === "D" ? "single" : "split",
      status: mapFileStatus(status),
      left: {
        label: status === "A" ? "Empty" : selectedLabel,
        text: leftText,
      },
      right: {
        label: status === "D" ? "Deleted" : "Working Tree",
        text: rightText,
      },
      binary: false,
      staged: false,
      readOnly: true,
      compareMode: "branchWorkingTree",
    };
  }

  async function buildFileDocument(
    repoRoot: string,
    repoId: string,
    relativePath: string,
    selectedRef: string,
    mode: BranchCompareMode,
    fileStatus?: BranchCompareFile["status"],
  ): Promise<WorkspaceDiffDocument | null> {
    return mode === "current"
      ? buildCompareWithCurrentDocument(
          repoRoot,
          repoId,
          relativePath,
          selectedRef,
          fileStatus,
        )
      : buildCompareWithWorkingTreeDocument(
          repoRoot,
          repoId,
          relativePath,
          selectedRef,
          fileStatus,
        );
  }

  async function applyFileFromBranch(
    repoRoot: string,
    selectedRef: string,
    relativePath: string,
    mode: BranchCompareMode,
  ): Promise<void> {
    // Defence in depth. The protocol validator already rejects operands starting
    // with "-", but an unvalidated ref here turns `git checkout <ref> -- <path>`
    // into `git checkout --force -- <path>`, which discards local edits with no
    // confirmation at all. Never trust the caller on a destructive command.
    assertSafeGitOperand(selectedRef, "branch ref");

    // Validate the parents, then operate on the lexical entry: the apply
    // replaces the final component via atomic rename (never following it),
    // so an existing hostile symlink at the destination must not veto its
    // own replacement. Only the parent chain is resolved — intermediate
    // symlinks escaping the repository are still refused.
    const resolved = await resolveRepoParentRealPath(repoRoot, relativePath);
    if (!resolved.ok) {
      throw new Error(resolved.message);
    }
    const safeRelative = resolved.relativePath;
    const lexicalPath = resolved.absolutePath;

    if (mode === "current") {
      await execGit(repoRoot, ["checkout", selectedRef, "--", safeRelative]);
      return;
    }

    async function isAbsent(): Promise<boolean> {
      try {
        return (await readTreeEntryAtRef(execGit, repoRoot, selectedRef, safeRelative)) === null;
      } catch {
        return false;
      }
    }

    let entry: TreeEntryAtRef | null;
    try {
      entry = await readTreeEntryAtRef(execGit, repoRoot, selectedRef, safeRelative);
    } catch (error) {
      // A failed `ls-tree` means "absent OR git could not answer" (stale
      // ref, permissions, exec failure). Deleting the working-tree file is
      // only correct on positive proof of absence; anything else propagates.
      if (!(await isAbsent())) {
        throw error;
      }
      entry = null;
    }
    if (entry === null) {
      // Positive proof of absence, re-checked immediately before the
      // destructive operation.
      if (!(await isAbsent())) {
        throw new Error(`Could not read ${safeRelative} from ${selectedRef}.`);
      }
      // The quarantine rename moves the link itself and the unlink only
      // touches the unpredictable quarantine name, so deleting a tracked
      // symlink is safe through this path.
      try {
        await unlinkInsideRepo(repoRoot, lexicalPath);
      } catch {
        throw new Error(`Could not apply deleted file from ${selectedRef}.`);
      }
      return;
    }

    if (entry.kind === "commit") {
      throw new Error(
        `Cannot apply submodule "${safeRelative}" from a branch; check it out with Git directly.`,
      );
    }

    const blob = await readBlobBytesAtRef(execGit, repoRoot, selectedRef, safeRelative);
    if (blob === null) {
      throw new Error(`Could not read ${safeRelative} from ${selectedRef}.`);
    }

    // New subdirectories from the branch are created before the guarded
    // write below re-validates the parent: a parent swap in between can at
    // most leave stray empty directories outside, never content.
    await fs.mkdir(path.dirname(lexicalPath), { recursive: true });
    if (entry.mode === "120000") {
      // Symlink entry: the blob bytes are the link target. Materialize a
      // real symlink (faithful to `git checkout`), never a text file.
      const target = blob.toString("utf8");
      await replaceFileAtomically(repoRoot, lexicalPath, (tmpPath) =>
        fs.symlink(target, tmpPath),
      );
      return;
    }
    if (entry.mode !== "100644" && entry.mode !== "100755") {
      throw new Error(
        `Unsupported Git file mode "${entry.mode}" for ${safeRelative}.`,
      );
    }
    await replaceFileAtomically(repoRoot, lexicalPath, async (tmpPath) => {
      await fs.writeFile(tmpPath, blob, { flag: "wx" });
      if (entry.mode === "100755") {
        await fs.chmod(tmpPath, 0o755);
      }
    });
  }

  return {
    currentBranchRef,
    listCompareWithCurrent,
    listCompareWithWorkingTree,
    listFiles,
    buildCompareWithCurrentDocument,
    buildCompareWithWorkingTreeDocument,
    buildFileDocument,
    applyFileFromBranch,
  };
}
