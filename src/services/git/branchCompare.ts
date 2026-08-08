import * as fs from "fs/promises";
import * as path from "path";
import type { BranchCompareFile, BranchCompareMode } from "../../shared/types/branch";
import type { WorkspaceDiffDocument } from "../../shared/types/diff";
import { isValidRepoRelativePath } from "../blameRefs";
import { resolveRepoRelativePath } from "../../util/repoPath";
import { stripGitConflictMarkers } from "../../util/stripGitConflictMarkers";
import type { GitExecFn } from "./types";

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

function mapFileStatus(
  status: BranchCompareFile["status"],
): WorkspaceDiffDocument["status"] {
  return status;
}

export function createBranchCompareApi(
  execGit: GitExecFn,
  isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
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
    const binary = await isBinaryFile(repoRoot, relativePath);

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
    const binary = await isBinaryFile(repoRoot, relativePath);

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
    const resolved = resolveRepoRelativePath(repoRoot, relativePath);
    if (!resolved.ok) {
      throw new Error(resolved.message);
    }
    const safeRelative = resolved.relativePath;
    const fullPath = resolved.absolutePath;

    if (mode === "current") {
      await execGit(repoRoot, ["checkout", selectedRef, "--", safeRelative]);
      return;
    }

    const blob = await readBlobAtRef(
      execGit,
      repoRoot,
      selectedRef,
      safeRelative,
    );
    if (blob === null) {
      try {
        await fs.unlink(fullPath);
      } catch {
        throw new Error(`Could not apply deleted file from ${selectedRef}.`);
      }
      return;
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, blob);
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