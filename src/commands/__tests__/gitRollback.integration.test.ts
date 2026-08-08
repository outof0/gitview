import { describe, it, expect, beforeAll, afterEach, vi, beforeEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { gitRollback } from "../gitMenuActions";
import {
  copyConflictRepo,
  ensureConflictFixture,
  readRepoFile,
} from "../../test/helpers/conflictRepoFixture";
import { createGitService } from "../../services/gitService";

const git = createGitService();

vi.mock("vscode", () => ({
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    asRelativePath: vi.fn((uri: { fsPath: string }) =>
      path.basename(uri.fsPath),
    ),
    getWorkspaceFolder: vi.fn((uri: { fsPath: string }) => ({
      uri: { fsPath: path.dirname(uri.fsPath) },
    })),
  },
  Uri: {
    file: (p: string) => ({ fsPath: p, scheme: "file" }),
  },
}));

describe("git rollback host integration", () => {
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

  it("gitRollback discards local edits on disk after confirmation", async () => {
    repoRoot = await copyConflictRepo();
    tempParent = path.dirname(repoRoot);

    await git.checkoutOurs(repoRoot, "file.txt");
    await git.addFile(repoRoot, "file.txt");
    const resolved = await readRepoFile(repoRoot, "file.txt");

    await fs.writeFile(path.join(repoRoot, "file.txt"), "local user edit\n");
    expect(await readRepoFile(repoRoot, "file.txt")).toBe("local user edit\n");

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      "Rollback" as never,
    );

    const uri = vscode.Uri.file(path.join(repoRoot, "file.txt"));
    await gitRollback(uri, repoRoot);

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    expect(await readRepoFile(repoRoot, "file.txt")).toBe(resolved);
  });

  it("gitRollback leaves disk unchanged when the user cancels", async () => {
    repoRoot = await copyConflictRepo();
    tempParent = path.dirname(repoRoot);

    await git.checkoutOurs(repoRoot, "file.txt");
    await git.addFile(repoRoot, "file.txt");
    await fs.writeFile(path.join(repoRoot, "file.txt"), "local user edit\n");

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      undefined as never,
    );

    const uri = vscode.Uri.file(path.join(repoRoot, "file.txt"));
    await gitRollback(uri, repoRoot);

    expect(await readRepoFile(repoRoot, "file.txt")).toBe("local user edit\n");
  });
});