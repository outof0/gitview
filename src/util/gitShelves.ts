import * as crypto from "node:crypto";
import { createShelfApi } from "../services/git/shelf";
import { createDefaultExecGit } from "../services/git/exec";
import { createStatusApi } from "../services/git/status";
import {
  createShelfStorage,
  type ShelfStorage,
} from "../storage/shelfStorage";
import type { GitExecFn } from "../services/git/types";

export type GitShelfRuntime = {
  execGit: GitExecFn;
  shelfStorage: ShelfStorage;
  refresh?: () => Promise<unknown>;
};

function stableRepoId(rootPath: string): string {
  return crypto.createHash("sha256").update(rootPath).digest("hex").slice(0, 16);
}

function resolveShelfRuntime(runtime?: GitShelfRuntime): GitShelfRuntime {
  if (runtime) {
    return runtime;
  }
  return {
    execGit: createDefaultExecGit(),
    shelfStorage: createShelfStorage(),
  };
}

async function listChangedPaths(
  repoRoot: string,
  scopePath: string | null,
  execGit: GitExecFn,
): Promise<string[]> {
  const { files } = await createStatusApi(execGit).getStatus(repoRoot, "shelf");
  if (!scopePath) {
    return [...new Set(files.map((file) => file.path))];
  }
  const normalizedScope = scopePath.replace(/\\/g, "/").replace(/\/$/, "");
  return [
    ...new Set(
      files
        .filter(
          (file) =>
            file.path === normalizedScope ||
            file.path.startsWith(`${normalizedScope}/`),
        )
        .map((file) => file.path),
    ),
  ];
}

/** Explorer shelve — same storage as Git Workspace (`shelfStorage` / index.json). */
export async function shelveChanges(
  repoRoot: string,
  scopePath: string | null,
  runtime?: GitShelfRuntime,
): Promise<boolean> {
  const resolved = resolveShelfRuntime(runtime);
  const paths = await listChangedPaths(repoRoot, scopePath, resolved.execGit);
  if (paths.length === 0) {
    return false;
  }

  const api = createShelfApi(resolved.execGit, resolved.shelfStorage);
  await api.shelveFiles(repoRoot, {
    repoId: stableRepoId(repoRoot),
    paths,
    name:
      scopePath ?
        `Shelf ${scopePath}`
      : `Shelf ${paths.length} file(s)`,
  });
  await resolved.refresh?.();
  return true;
}

export async function unshelveLatest(
  repoRoot: string,
  runtime?: GitShelfRuntime,
): Promise<boolean> {
  const resolved = resolveShelfRuntime(runtime);
  const api = createShelfApi(resolved.execGit, resolved.shelfStorage);
  const shelves = await api.listShelves(repoRoot, stableRepoId(repoRoot));
  const latest = shelves[0];
  if (!latest) {
    return false;
  }
  await api.unshelve(repoRoot, latest.id, true);
  await resolved.refresh?.();
  return true;
}
