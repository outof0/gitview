import type { BlameCacheEntry, GitExecFn } from "./types";
import { defaultExecGit } from "./exec";
import { createRepoApi } from "./repo";
import { createMergeApi } from "./merge";
import { createBlameApi } from "./blame";
import { createLogApi } from "./log";
import { createDiffApi } from "./diff";
import { createCapabilitiesApi } from "./capabilities";
import { createCommitApi } from "./commit";
import { createStagingApi } from "./staging";
import { createStatusApi } from "./status";
import { createSyncApi } from "./sync";
import { createBranchApi } from "./branch";
import { createBranchCompareApi } from "./branchCompare";
import { createWorkspaceDiffApi } from "./workspaceDiff";


export type { GitExecFn, ExecResult } from "./types";
export {
  createDefaultExecGit,
  createConfigurableGitRunner,
  defaultExecGit,
  nonInteractiveContinueEnv,
} from "./exec";
export type { ConfigurableGitRunner } from "./exec";
export { createCapabilitiesApi, deriveCapabilities } from "./capabilities";
export type { GitCapabilities } from "./capabilities";
export { createStatusApi, parsePorcelainV1Z, mapEntryToFileStatus } from "./status";
export type { ParsedBranchHeader, RawStatusEntry } from "./status";
export { createStagingApi } from "./staging";
export { createCommitApi } from "./commit";
export type { CommitInput, CommitResult } from "./commit";
export { createSyncApi } from "./sync";
export type { PullStrategy, PushResult } from "./sync";
export { createBranchApi } from "./branch";
export type { CheckoutOptions } from "./branch";
export { createBranchCompareApi } from "./branchCompare";
export { createWorkspaceDiffApi } from "./workspaceDiff";

export type GitServiceDeps = {
  execGit?: GitExecFn;
  blameCache?: Map<string, BlameCacheEntry>;
};

export function createGitService(deps?: GitServiceDeps) {
  const execGit = deps?.execGit ?? defaultExecGit;
  const blameCache = deps?.blameCache ?? new Map<string, BlameCacheEntry>();

  const repo = createRepoApi(execGit);
  const merge = createMergeApi(execGit);
  const blame = createBlameApi(execGit, blameCache, merge.isBinaryFile);
  const log = createLogApi(execGit);
  const diff = createDiffApi(execGit, merge.isBinaryFile);
  const capabilities = createCapabilitiesApi(execGit);
  const status = createStatusApi(execGit);
  const staging = createStagingApi(execGit);
  const commit = createCommitApi(execGit);
  const sync = createSyncApi(execGit);
  const branch = createBranchApi(execGit);
  const branchCompare = createBranchCompareApi(execGit, merge.isBinaryFile);
  const workspaceDiff = createWorkspaceDiffApi(execGit, merge.isBinaryFile);
  return {
    execGit,
    ...repo,
    ...merge,
    ...blame,
    ...log,
    ...diff,
    ...capabilities,
    ...status,
    ...staging,
    ...commit,
    ...sync,
    ...branch,
    ...branchCompare,
    ...workspaceDiff,
  };
}

export type GitService = ReturnType<typeof createGitService>;
