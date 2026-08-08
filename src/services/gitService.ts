/** Back-compat re-export — implementation lives in ./git/*. */
export {
  createGitService,
  createDefaultExecGit,
  createConfigurableGitRunner,
  defaultExecGit,
  type GitServiceDeps,
  type GitService,
  type ConfigurableGitRunner,
  type GitExecFn,
  type ExecResult,
} from "./git";
