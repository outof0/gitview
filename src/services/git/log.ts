import type { LogQueryFilters } from "../../shared/types/log";
import type {
  BlameSide,
  ChangesFromSideOptions,
  ChangesFromSideResult,
  CommitDetailResult,
  LogOptions,
  LogResult,
} from "../../types/blame";
import {
  changesFromSideRevisionRange,
  resolveMergeRefs,
} from "../mergeHistory";
import {
  LOG_FORMAT,
  parseGitLogWithNameStatus,
} from "../logParser";
import { isValidRepoRelativePath } from "../blameRefs";
import { DEFAULT_LOG_LIMIT, type GitExecFn } from "./types";
import { isFileNotAtRefError } from "./exec";
import { createLogDagApi } from "./logDag";

function appendLogSkip(args: string[], skip: number | undefined): void {
  if (skip !== undefined && skip > 0) {
    args.push(`--skip=${skip}`);
  }
}

export type LogApiOptions = {
  supportsDiffMerges?: (repoRoot: string) => Promise<boolean>;
};

export function createLogApi(
  execGit: GitExecFn,
  options?: LogApiOptions,
) {
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
        "--parents",
        "--follow",
        "--name-status",
        `--format=${LOG_FORMAT}`,
        `-n`,
        String(limit),
        ...(opts?.skip && opts.skip > 0 ? [`--skip=${opts.skip}`] : []),
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
        "--parents",
        "--name-status",
        `--format=${LOG_FORMAT}`,
        `-n`,
        String(limit),
        ...(opts?.skip && opts.skip > 0 ? [`--skip=${opts.skip}`] : []),
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
      "--parents",
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
      const [meta, nameStatus] = await Promise.all([
        execGit(repoRoot, ["show", "--no-patch", `--format=${LOG_FORMAT}`, sha]),
        // Split merge diffs by parent so annotate can show files touched by a
        // merge instead of presenting the misleading empty file pane. diff-tree
        // asks Git for names/statuses directly and avoids constructing show's
        // commit presentation for every parent.
        execGit(repoRoot, [
          "diff-tree",
          "--no-commit-id",
          "--name-status",
          "-r",
          "-m",
          "--root",
          sha,
        ]),
      ]);

      const separator = meta.stdout.endsWith("\n") ? "" : "\n";
      const commit = parseGitLogWithNameStatus(
        `${meta.stdout}${separator}${nameStatus.stdout}`,
      )[0];
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

  async function appendRepoLogQueryArgs(
    repoRoot: string,
    args: string[],
    query: LogQueryFilters | undefined,
  ): Promise<boolean> {
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

    // Include the user-facing graph refs, but not Git's entire ref namespace.
    // `--all` also traverses refs/cline/*, refs/codex/* and other tool-owned
    // checkpoints; those synthetic commits can have unchanged trees and crowd
    // real history out of the bounded result.
    if (query?.range === "all" && !query.branch?.trim()) {
      args.push("--branches", "--remotes", "--tags", "HEAD");
    }

    if (query?.range === "incoming" || query?.range === "outgoing") {
      const upstream = await resolveUpstreamRef(repoRoot);
      if (!upstream) {
        return false;
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
    return true;
  }

  function parseShaList(stdout: string): string[] {
    return stdout.split(/\s+/).filter(Boolean);
  }

  async function logRepo(
    repoRoot: string,
    opts?: LogOptions | LogQueryFilters,
  ): Promise<LogResult> {
    const limit = opts?.limit ?? DEFAULT_LOG_LIMIT;
    const query = opts as LogQueryFilters | undefined;
    const args = ["log", "--parents"];
    // Keep the initial graph query bounded to one record/diff per commit.
    // Empty merge diffs are resolved lazily when that node is selected. Git
    // 2.30 and older reject this flag, so feature-detect it per repository.
    const supportsDiffMerges = options?.supportsDiffMerges
      ? await options.supportsDiffMerges(repoRoot)
      : true;
    if (supportsDiffMerges) {
      args.push("--diff-merges=first-parent");
    }
    args.push(
      "--name-status",
      `--format=${LOG_FORMAT}`,
      `-n`,
      String(limit),
    );
    appendLogSkip(args, query?.skip);

    if (!(await appendRepoLogQueryArgs(repoRoot, args, query))) {
      return { ok: true, commits: [] };
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

  /**
   * Every SHA the repo-scope query matches, without pagination. Used to tell
   * "parent not loaded yet" apart from "parent filtered out" for filters git
   * does not rewrite into `%P`.
   */
  async function listRepoShas(
    repoRoot: string,
    opts?: LogOptions | LogQueryFilters,
  ): Promise<string[] | null> {
    const query = opts as LogQueryFilters | undefined;
    const args = ["log", "--format=%H"];
    if (!(await appendRepoLogQueryArgs(repoRoot, args, query))) {
      return null;
    }
    try {
      const { stdout } = await execGit(repoRoot, args);
      return parseShaList(stdout);
    } catch {
      return null;
    }
  }

  async function listFileShas(
    repoRoot: string,
    relativePath: string,
    opts?: LogOptions,
  ): Promise<string[] | null> {
    if (!isValidRepoRelativePath(relativePath)) {
      return null;
    }
    const branchArgs = opts?.branch ? [opts.branch] : [];
    try {
      const { stdout } = await execGit(repoRoot, [
        "log",
        "--follow",
        "--format=%H",
        ...branchArgs,
        "--",
        relativePath,
      ]);
      return parseShaList(stdout);
    } catch {
      return null;
    }
  }

  const { logDag } = createLogDagApi(execGit);

  return {
    logFile,
    logFolder,
    logRepo,
    listRepoShas,
    listFileShas,
    logChangesFromSide,
    showCommit,
    logDag,
  };
}
