import { describe, it, expect, beforeAll, afterEach, vi, beforeEach } from "vitest";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import { gitGetFromRevision } from "../gitMenuActions";
import { createGitService } from "../../services/gitService";
import {
  copyConflictRepo,
  ensureConflictFixture,
  readRepoFile,
} from "../../test/helpers/conflictRepoFixture";

const exec = promisify(execFile);
const git = createGitService();

vi.mock("vscode", () => ({
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    workspaceFolders: [],
  },
  Uri: {
    file: (p: string) => ({ fsPath: p, scheme: "file" }),
  },
}));

async function readAtRevision(
  repoRoot: string,
  sha: string,
  relativePath: string,
): Promise<string> {
  const { stdout } = await exec(
    "git",
    ["--no-pager", "show", `${sha}:${relativePath}`],
    { cwd: repoRoot },
  );
  return stdout;
}

describe("git getFromRevision host integration", () => {
  let repoRoot = "";
  let tempParent = "";

  beforeAll(async () => {
    await ensureConflictFixture();
  }, 120_000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (tempParent) {
      await fs.rm(tempParent, { recursive: true, force: true });
      tempParent = "";
      repoRoot = "";
    }
  });

  it("gitGetFromRevision checks out revision content on disk after confirmation", async () => {
    repoRoot = await copyConflictRepo();
    tempParent = path.dirname(repoRoot);

    const log = await git.logFile(repoRoot, "file.txt", { limit: 5 });
    expect(log.ok).toBe(true);
    if (!log.ok) {
      throw new Error(log.message);
    }
    expect(log.commits.length).toBeGreaterThan(0);

    const target = log.commits[0]!;
    const expected = await readAtRevision(repoRoot, target.sha, "file.txt");
    const before = await readRepoFile(repoRoot, "file.txt");
    expect(before).toMatch(/<<<<<<<|=======|>>>>>>>/);

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Get from Revision" as never,
    );

    await gitGetFromRevision(target.sha, "file.txt", repoRoot);

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    const onDisk = await readRepoFile(repoRoot, "file.txt");
    expect(onDisk).toBe(expected);
    expect(onDisk).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
  });

  it("gitGetFromRevision is a no-op on disk when the user cancels", async () => {
    repoRoot = await copyConflictRepo();
    tempParent = path.dirname(repoRoot);

    const log = await git.logFile(repoRoot, "file.txt", { limit: 1 });
    expect(log.ok).toBe(true);
    if (!log.ok) {
      throw new Error(log.message);
    }

    const before = await readRepoFile(repoRoot, "file.txt");
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    await gitGetFromRevision(log.commits[0]!.sha, "file.txt", repoRoot);

    expect(await readRepoFile(repoRoot, "file.txt")).toBe(before);
  });
});