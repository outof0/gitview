import { execFile, spawn } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const exec = promisify(execFile);

let fixtureGate: Promise<void> = Promise.resolve();

async function withFixtureGate<T>(fn: () => Promise<T>): Promise<T> {
  const previous = fixtureGate;
  let release!: () => void;
  fixtureGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function updateIndexInfo(
  repoRoot: string,
  indexInfo: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", ["update-index", "--index-info"], {
      cwd: repoRoot,
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `git update-index --index-info failed (${code}): ${stderr.trim()}`,
        ),
      );
    });
    child.stdin.write(indexInfo.endsWith("\n") ? indexInfo : `${indexInfo}\n`);
    child.stdin.end();
  });
}

export function conflictFixturePath(): string {
  return path.join(process.cwd(), "test-conflict-repo");
}

/** Paths that must stay unmerged for merge-resolve integration tests. */
export const REQUIRED_FIXTURE_UNMERGED_PATHS = [
  "file.txt",
  "utils.js",
  "edge/aa-file.ts",
  "edge/ud-file.ts",
  "edge/du-file.ts",
] as const;

async function validateConflictFixture(root: string): Promise<{
  valid: boolean;
  missing: string[];
}> {
  try {
    await fs.access(path.join(root, ".git", "MERGE_HEAD"));
  } catch {
    return { valid: false, missing: ["MERGE_HEAD"] };
  }

  const missing: string[] = [];
  for (const relativePath of REQUIRED_FIXTURE_UNMERGED_PATHS) {
    if (!(await hasUnmergedStages(root, relativePath))) {
      missing.push(relativePath);
    }
  }
  return { valid: missing.length === 0, missing };
}

async function rebuildConflictFixture(root: string): Promise<void> {
  await exec("bash", ["scripts/setup-test-repo.sh"], {
    cwd: process.cwd(),
  });
  const validation = await validateConflictFixture(root);
  if (!validation.valid) {
    throw new Error(
      `Conflict fixture at ${root} is invalid after setup (missing unmerged: ${validation.missing.join(", ")}).`,
    );
  }
}

async function ensureConflictFixtureUnlocked(): Promise<string> {
  const root = conflictFixturePath();
  const validation = await validateConflictFixture(root);
  if (validation.valid) {
    return root;
  }
  await rebuildConflictFixture(root);
  return root;
}

export async function ensureConflictFixture(): Promise<string> {
  return withFixtureGate(() => ensureConflictFixtureUnlocked());
}

export async function copyConflictRepo(): Promise<string> {
  return withFixtureGate(async () => {
    const src = await ensureConflictFixtureUnlocked();
    const dest = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), "gitview-conflict-")),
      "repo",
    );
    await fs.cp(src, dest, { recursive: true });
    return dest;
  });
}

export async function gitPorcelain(repoRoot: string): Promise<string> {
  const { stdout } = await exec("git", ["status", "--porcelain"], {
    cwd: repoRoot,
  });
  return stdout;
}

export async function readRepoFile(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

export async function hasUnmergedStages(
  repoRoot: string,
  relativePath: string,
): Promise<boolean> {
  const { stdout } = await exec("git", ["ls-files", "-u", relativePath], {
    cwd: repoRoot,
  });
  return stdout.trim().length > 0;
}

/** True when the path has a single stage-0 index entry (merge conflict cleared). */
export async function isResolvedInIndex(
  repoRoot: string,
  relativePath: string,
): Promise<boolean> {
  const { stdout } = await exec("git", ["ls-files", "-s", relativePath], {
    cwd: repoRoot,
  });
  const lines = stdout.trim().split("\n").filter(Boolean);
  return lines.length === 1 && /\s0\t/.test(lines[0]!);
}

async function hashBlob(
  repoRoot: string,
  content: string | Buffer,
): Promise<string> {
  const tmpPath = path.join(
    repoRoot,
    `.gitview-blob-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await fs.writeFile(tmpPath, content);
  try {
    const { stdout } = await exec("git", ["hash-object", "-w", tmpPath], {
      cwd: repoRoot,
    });
    return stdout.trim();
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

/** Inject a UU entry whose base/ours/theirs produce no conflict blocks. */
export async function seedNonConflictingUnmerged(
  repoRoot: string,
  relativePath: string,
  stages: { base: string; ours: string; theirs: string },
  worktreeContent?: string,
): Promise<void> {
  const baseHash = await hashBlob(repoRoot, stages.base);
  const oursHash = await hashBlob(repoRoot, stages.ours);
  const theirsHash = await hashBlob(repoRoot, stages.theirs);
  const indexInfo = [
    `100644 ${baseHash} 1\t${relativePath}`,
    `100644 ${oursHash} 2\t${relativePath}`,
    `100644 ${theirsHash} 3\t${relativePath}`,
  ].join("\n");
  await updateIndexInfo(repoRoot, indexInfo);
  const absolutePath = path.join(repoRoot, relativePath);
  await fs.writeFile(absolutePath, worktreeContent ?? stages.ours);
}

/** Inject a UU binary conflict (three distinct blob stages). */
export async function seedBinaryUnmerged(
  repoRoot: string,
  relativePath: string,
  stages: { base: Buffer; ours: Buffer; theirs: Buffer },
): Promise<void> {
  const baseHash = await hashBlob(repoRoot, stages.base);
  const oursHash = await hashBlob(repoRoot, stages.ours);
  const theirsHash = await hashBlob(repoRoot, stages.theirs);
  const indexInfo = [
    `100644 ${baseHash} 1\t${relativePath}`,
    `100644 ${oursHash} 2\t${relativePath}`,
    `100644 ${theirsHash} 3\t${relativePath}`,
  ].join("\n");
  await updateIndexInfo(repoRoot, indexInfo);
  await fs.writeFile(path.join(repoRoot, relativePath), stages.ours);
}