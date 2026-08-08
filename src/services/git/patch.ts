import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { GitExecFn } from "./types";

export type PatchApplyOptions = {
  checkOnly?: boolean;
  reverse?: boolean;
  strip?: number;
  directory?: string;
};

export function createPatchApi(execGit: GitExecFn) {
  async function createFromPaths(
    repoRoot: string,
    paths: string[],
  ): Promise<string> {
    const args = ["diff", "HEAD", "--"];
    if (paths.length > 0) {
      args.push(...paths);
    } else {
      args.push(".");
    }
    const { stdout } = await execGit(repoRoot, args);
    return stdout;
  }

  async function withTempPatch<T>(
    patchContent: string,
    fn: (patchPath: string) => Promise<T>,
  ): Promise<T> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-patch-"));
    const patchPath = path.join(dir, "change.patch");
    try {
      await fs.writeFile(patchPath, patchContent, "utf8");
      return await fn(patchPath);
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function applyPatch(
    repoRoot: string,
    patchContent: string,
    opts?: PatchApplyOptions,
  ): Promise<void> {
    await withTempPatch(patchContent, async (patchPath) => {
      const args = ["apply"];
      if (opts?.checkOnly) {
        args.push("--check");
      }
      if (opts?.reverse) {
        args.push("--reverse");
      }
      if (opts?.strip != null && opts.strip > 0) {
        args.push(`-p${opts.strip}`);
      }
      if (opts?.directory) {
        args.push(`--directory=${opts.directory}`);
      }
      args.push(patchPath);
      await execGit(repoRoot, args);
    });
  }

  return { createFromPaths, applyPatch };
}