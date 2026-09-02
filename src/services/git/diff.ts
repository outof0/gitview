import type {
  FileDiffAtCommitResult,
  FilePatchResult,
  GitChangedFileStatus,
} from "../../types/blame";
import { isValidCommitSha, isValidRepoRelativePath } from "../blameRefs";
import type { GitExecFn } from "./types";

type BlobReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDiffApi(
  execGit: GitExecFn,
  isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
  async function readBlobAtRef(
    repoRoot: string,
    ref: string,
    relativePath: string,
  ): Promise<BlobReadResult<string>> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "show",
        `${ref}:${relativePath}`,
      ]);
      return { ok: true, value: stdout };
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  }

  async function readBlobBufferAtRef(
    repoRoot: string,
    ref: string,
    relativePath: string,
  ): Promise<BlobReadResult<Buffer>> {
    try {
      const result = await execGit(
        repoRoot,
        ["show", `${ref}:${relativePath}`],
        { encoding: "buffer" },
      );
      return {
        ok: true,
        value: result.stdoutBuffer ?? Buffer.from(result.stdout, "utf8"),
      };
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
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

  function isBinaryBlob(blob: Buffer): boolean {
    const sampleLength = Math.min(blob.length, 8_000);
    for (let index = 0; index < sampleLength; index++) {
      if (blob[index] === 0) {
        return true;
      }
    }
    return false;
  }

  async function fileDiffAtCommit(
    repoRoot: string,
    sha: string,
    relativePath: string,
    status?: GitChangedFileStatus,
    knownParent?: string | null,
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
    const parent =
      knownParent === undefined
        ? await parentSha(repoRoot, sha)
        : knownParent;
    const parentLabel = parent ? shortRef(parent) : "parent";
    const commitLabel = shortRef(sha);

    if (effectiveStatus === "A") {
      const result = await readBlobBufferAtRef(repoRoot, sha, relativePath);
      if (!result.ok) {
        return {
          ok: false,
          code: "GIT_ERROR",
          message: `Could not read ${relativePath} at ${commitLabel}: ${result.message}`,
        };
      }
      const binary = isBinaryBlob(result.value);
      return {
        ok: true,
        diff: {
          layout: "single",
          status: "A",
          left: null,
          right: {
            label: commitLabel,
            text: binary
              ? "[Binary file — preview not available]"
              : result.value.toString("utf8"),
          },
          binary,
        },
      };
    }

    if (effectiveStatus === "D") {
      const result = parent
        ? await readBlobBufferAtRef(repoRoot, parent, relativePath)
        : null;
      if (result && !result.ok) {
        return {
          ok: false,
          code: "GIT_ERROR",
          message: `Could not read ${relativePath} at ${parentLabel}: ${result.message}`,
        };
      }
      const blob = result?.ok ? result.value : null;
      const binary = blob ? isBinaryBlob(blob) : false;
      return {
        ok: true,
        diff: {
          layout: "single",
          status: "D",
          left: {
            label: parentLabel,
            text: binary
              ? "[Binary file — preview not available]"
              : (blob?.toString("utf8") ?? ""),
          },
          right: null,
          binary,
        },
      };
    }

    const [leftBlob, rightBlob] = await Promise.all([
      parent
        ? readBlobBufferAtRef(repoRoot, parent, relativePath)
        : Promise.resolve(null),
      readBlobBufferAtRef(repoRoot, sha, relativePath),
    ]);
    if (!rightBlob.ok) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: `Could not read ${relativePath} at ${commitLabel}: ${rightBlob.message}`,
      };
    }
    if (leftBlob && !leftBlob.ok) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: `Could not read ${relativePath} at ${parentLabel}: ${leftBlob.message}`,
      };
    }
    const leftValue = leftBlob?.ok ? leftBlob.value : null;
    const rightValue = rightBlob.value;
    const binary =
      (leftValue ? isBinaryBlob(leftValue) : false) || isBinaryBlob(rightValue);
    return {
      ok: true,
      diff: {
        layout: "split",
        status: effectiveStatus,
        left: {
          label: parentLabel,
          text: binary
            ? "[Binary file — preview not available]"
            : (leftValue?.toString("utf8") ?? ""),
        },
        right: {
          label: commitLabel,
          text: binary
            ? "[Binary file — preview not available]"
            : rightValue.toString("utf8"),
        },
        binary,
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

    const result = await readBlobAtRef(repoRoot, sha, relativePath);
    if (!result.ok) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: `Could not read ${relativePath} at ${shortRef(sha)}: ${result.message}`,
      };
    }
    return { ok: true, text: result.value, binary: false };
  }

  return { fileDiffAtCommit, filePatchAtCommit, readFileAtRevision };
}
