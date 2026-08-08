import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { defaultExecGit } from "../../services/git/exec";

const exec = promisify(execFile);

export type TempGitRepo = {
  root: string;
  cleanup: () => Promise<void>;
};

export async function createTempGitRepo(): Promise<TempGitRepo> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-git-"));
  const root = path.join(parent, "repo");
  await fs.mkdir(root);

  const run = (args: string[]) =>
    exec("git", args, { cwd: root, env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" } });

  await run(["init", "-b", "main"]);
  await run(["config", "user.name", "Test"]);
  await run(["config", "user.email", "test@example.com"]);
  await run(["config", "core.autocrlf", "false"]);
  await fs.writeFile(path.join(root, "README.md"), "# test\n");
  await run(["add", "README.md"]);
  await run(["commit", "-m", "Initial commit"]);

  return {
    root,
    cleanup: () =>
      fs.rm(parent, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      }),
  };
}

export async function writeRepoFile(
  repoRoot: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const full = path.join(repoRoot, relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

export { defaultExecGit as execGit };
