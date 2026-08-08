import type {
  FileDiffAtCommitResult,
  FilePatchResult,
  GitChangedFileStatus,
} from "../../types/blame";
import { isValidCommitSha, isValidRepoRelativePath } from "../blameRefs";
import type { GitExecFn } from "./types";

export function createDiffApi(
  execGit: GitExecFn,
  isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
  async function readBlobAtRef(
    repoRoot: string,
    ref: string,
    relativePath: string,
  ): Promise<string | null> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "show",
        `${ref}:${relativePath}`,
      ]);
      return stdout;
    } catch {
      return null;
    }
  }

  async function parentSha(
    repoRoot: string,
    sha: string,
  ): Promise<string | null> {
    try {
      const { stdout } = await execGit(repoRoot, ["rev-parse", `${sha}^`]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  function shortRef(sha: string): string {
    return sha.length > 7 ? sha.slice(0, 7) : sha;
  }

  async function fileDiffAtCommit(
    repoRoot: string,
    sha: string,
    relativePath: string,
    status?: GitChangedFileStatus,
  ): Promise<FileDiffAtCommitResult> {
    if (!isValidRepoRelativePath(relativePath)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }
    if (!isValidCommitSha(sha)) {
      return { ok: false, code: "INVALID_SHA", message: "Invalid commit SHA." };
    }

    const effectiveStatus = status ?? "M";
    const parent = await parentSha(repoRoot, sha);
    const parentLabel = parent ? shortRef(parent) : "parent";
    const commitLabel = shortRef(sha);

    if (await isBinaryFile(repoRoot, relativePath)) {
      return {
        ok: true,
        diff: {
          layout:
            effectiveStatus === "A" || effectiveStatus === "D"
              ? "single"
              : "split",
          status: effectiveStatus,
          left:
            effectiveStatus === "A"
              ? null
              : parent
                ? {
                    label: parentLabel,
                    text: "[Binary file — preview not available]",
                  }
                : null,
          right:
            effectiveStatus === "D"
              ? null
              : {
                  label: commitLabel,
                  text: "[Binary file — preview not available]",
                },
          binary: true,
        },
      };
    }

    if (effectiveStatus === "A") {
      const text = (await readBlobAtRef(repoRoot, sha, relativePath)) ?? "";
      return {
        ok: true,
        diff: {
          layout: "single",
          status: "A",
          left: null,
          right: { label: commitLabel, text },
        },
      };
    }

    if (effectiveStatus === "D") {
      const text = parent
        ? ((await readBlobAtRef(repoRoot, parent, relativePath)) ?? "")
        : "";
      return {
        ok: true,
        diff: {
          layout: "single",
          status: "D",
          left: { label: parentLabel, text },
          right: null,
        },
      };
    }

    const leftText = parent
      ? ((await readBlobAtRef(repoRoot, parent, relativePath)) ?? "")
      : "";
    const rightText = (await readBlobAtRef(repoRoot, sha, relativePath)) ?? "";
    return {
      ok: true,
      diff: {
        layout: "split",
        status: effectiveStatus,
        left: { label: parentLabel, text: leftText },
        right: { label: commitLabel, text: rightText },
      },
    };
  }

  async function filePatchAtCommit(
    repoRoot: string,
    sha: string,
    relativePath: string,
  ): Promise<FilePatchResult> {
    if (!isValidRepoRelativePath(relativePath)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }
    if (!isValidCommitSha(sha)) {
      return { ok: false, code: "INVALID_SHA", message: "Invalid commit SHA." };
    }

    try {
      const { stdout } = await execGit(repoRoot, [
        "log",
        "-1",
        "-p",
        "--format=",
        sha,
        "--",
        relativePath,
      ]);
      if (stdout.trim()) {
        return { ok: true, patch: stdout };
      }
    } catch {
      // fall through — e.g. first commit without parent patch
    }

    try {
      const { stdout } = await execGit(repoRoot, [
        "show",
        sha,
        "--format=",
        "--",
        relativePath,
      ]);
      return { ok: true, patch: stdout };
    } catch (err) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function readFileAtRevision(
    repoRoot: string,
    sha: string,
    relativePath: string,
  ): Promise<
    | { ok: true; text: string; binary: boolean }
    | { ok: false; code: string; message: string }
  > {
    if (!isValidRepoRelativePath(relativePath)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }
    if (!isValidCommitSha(sha)) {
      return { ok: false, code: "INVALID_SHA", message: "Invalid commit SHA." };
    }

    const binary = await isBinaryFile(repoRoot, relativePath);
    if (binary) {
      return { ok: true, text: "", binary: true };
    }

    const text = await readBlobAtRef(repoRoot, sha, relativePath);
    if (text === null) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "File does not exist at this revision.",
      };
    }
    return { ok: true, text, binary: false };
  }

  return { fileDiffAtCommit, filePatchAtCommit, readFileAtRevision };
}