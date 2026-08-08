import type { LogQueryFilters } from "../../shared/types/log";
import type {
  BlameSide,
  ChangesFromSideOptions,
  ChangesFromSideResult,
  CommitDetailResult,
  LogOptions,
  LogResult,
} from "../../types/blame";
import { changesFromSideRevisionRange, resolveMergeRefs } from "../mergeHistory";
import {
  LOG_FORMAT,
  parseGitLogWithNameStatus,
  parseShowCommitOutput,
} from "../logParser";
import { isValidRepoRelativePath } from "../blameRefs";
import { DEFAULT_LOG_LIMIT, type GitExecFn } from "./types";
import { isFileNotAtRefError } from "./exec";

export function createLogApi(execGit: GitExecFn) {
  async function resolveUpstreamRef(repoRoot: string): Promise<string | null> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        "@{upstream}",
      ]);
      const upstream = stdout.trim();
      return upstream || null;
    } catch {
      return null;
    }
  }

  async function logFile(
    repoRoot: string,
    relativePath: string,
    opts?: LogOptions,
  ): Promise<LogResult> {
    if (!isValidRepoRelativePath(relativePath)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }

    const limit = opts?.limit ?? DEFAULT_LOG_LIMIT;
    const branchArgs = opts?.branch ? [opts.branch] : [];
    try {
      const { stdout } = await execGit(repoRoot, [
        "log",
        "--follow",
        "--name-status",
        `--format=${LOG_FORMAT}`,
        `-n`,
        String(limit),
        ...branchArgs,
        "--",
        relativePath,
      ]);
      return { ok: true, commits: parseGitLogWithNameStatus(stdout) };
    } catch (err) {
      if (isFileNotAtRefError(err)) {
        return {
          ok: false,
          code: "PATH_NOT_FOUND",
          message: `No history found for ${relativePath}.`,
        };
      }
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function logFolder(
    repoRoot: string,
    folderPath: string,
    opts?: LogOptions,
  ): Promise<LogResult> {
    const normalized =
      folderPath === "." || folderPath === "./" ? "" : folderPath;
    if (normalized && !isValidRepoRelativePath(normalized)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }

    const limit = opts?.limit ?? DEFAULT_LOG_LIMIT;
    const logPath = normalized ? `${normalized}/` : "";
    const branchArgs = opts?.branch ? [opts.branch] : [];
    try {
      const { stdout } = await execGit(repoRoot, [
        "log",
        "--name-status",
        `--format=${LOG_FORMAT}`,
        `-n`,
        String(limit),
        ...branchArgs,
        "--",
        logPath || ".",
      ]);
      return { ok: true, commits: parseGitLogWithNameStatus(stdout) };
    } catch (err) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function logChangesFromSide(
    repoRoot: string,
    side: BlameSide,
    opts?: ChangesFromSideOptions,
  ): Promise<ChangesFromSideResult> {
    if (opts?.filterPath && !isValidRepoRelativePath(opts.filterPath)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }

    const refsResult = await resolveMergeRefs(execGit, repoRoot);
    if (!refsResult.ok) {
      return {
        ok: false,
        code: refsResult.code,
        message: refsResult.message,
      };
    }

    const { refs } = refsResult;
    const revisionRange = changesFromSideRevisionRange(refs, side);
    const branchRef = side === "ours" ? refs.oursRef : refs.theirsRef;
    const limit = opts?.limit ?? DEFAULT_LOG_LIMIT;

    const args = [
      "log",
      "--name-status",
      `--format=${LOG_FORMAT}`,
      `-n`,
      String(limit),
      revisionRange,
    ];
    if (opts?.filterPath) {
      args.push("--", opts.filterPath);
    }

    try {
      const { stdout } = await execGit(repoRoot, args);
      const commits = parseGitLogWithNameStatus(stdout);
      const pathSet = new Set<string>();
      for (const commit of commits) {
        for (const f of commit.changedFiles) {
          pathSet.add(f.path);
        }
      }
      return {
        ok: true,
        side,
        mergeBase: refs.mergeBase,
        revisionRange,
        branchRef,
        commits,
        allChangedPaths: [...pathSet].sort(),
      };
    } catch (err) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function showCommit(
    repoRoot: string,
    sha: string,
  ): Promise<CommitDetailResult> {
    try {
      const [meta, body, nameStatus, atOut] = await Promise.all([
        execGit(repoRoot, ["show", "--format=fuller", "--no-patch", sha]),
        execGit(repoRoot, ["show", "--format=%b", "--no-patch", sha]),
        execGit(repoRoot, [
          "show",
          "--name-status",
          "--format=",
          sha,
        ]),
        execGit(repoRoot, ["show", "-s", "--format=%at", sha]),
      ]);

      const commit = parseShowCommitOutput(
        meta.stdout,
        body.stdout,
        nameStatus.stdout,
        atOut.stdout.trim(),
      );
      if (!commit) {
        return {
          ok: false,
          code: "GIT_ERROR",
          message: `Could not parse commit ${sha}.`,
        };
      }
      return { ok: true, commit };
    } catch (err) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function logRepo(
    repoRoot: string,
    opts?: LogOptions | LogQueryFilters,
  ): Promise<LogResult> {
    const limit = opts?.limit ?? DEFAULT_LOG_LIMIT;
    const query = opts as LogQueryFilters | undefined;
    const args = [
      "log",
      "--name-status",
      `--format=${LOG_FORMAT}`,
      `-n`,
      String(limit),
    ];

    if (query?.author?.trim()) {
      args.push(`--author=${query.author.trim()}`);
    }
    if (query?.since?.trim()) {
      args.push(`--since=${query.since.trim()}`);
    }
    if (query?.until?.trim()) {
      args.push(`--until=${query.until.trim()}`);
    }
    if (query?.grep?.trim()) {
      args.push(`--grep=${query.grep.trim()}`);
    }
    if (query?.noMerges) {
      args.push("--no-merges");
    }
    if (query?.firstParent) {
      args.push("--first-parent");
    }

    if (query?.range === "incoming" || query?.range === "outgoing") {
      const upstream = await resolveUpstreamRef(repoRoot);
      if (!upstream) {
        return { ok: true, commits: [] };
      }
      if (query.range === "incoming") {
        args.push(`HEAD..${upstream}`);
      } else {
        args.push(`${upstream}..HEAD`);
      }
    } else if (query?.branch?.trim()) {
      args.push(query.branch.trim());
    }

    if (query?.path?.trim()) {
      args.push("--", query.path.trim());
    }

    try {
      const { stdout } = await execGit(repoRoot, args);
      return { ok: true, commits: parseGitLogWithNameStatus(stdout) };
    } catch (err) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { logFile, logFolder, logRepo, logChangesFromSide, showCommit };
}
