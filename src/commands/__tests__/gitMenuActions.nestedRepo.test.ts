import "./gitMenuActions.testSetup";
import { describe, it, expect, vi } from "vitest";
import * as vscode from "vscode";
import { gitCheckoutBranch, gitCreateBranch } from "../gitMenuActions";
import type { GitMenuPresentation } from "../gitMenuPresentation";
import {
  mockFindRepoRoot,
  mockRepoRootForPath,
} from "./gitMenuActions.testSetup";

function nestedRoot(startPath: string): string | null {
  if (startPath === "/repo/nested" || startPath.startsWith("/repo/nested/")) {
    return "/repo/nested";
  }
  return mockRepoRootForPath(startPath);
}

describe("gitMenuActions nested repositories", () => {
  it("gitCheckoutBranch forwards the resolved nested root to the presentation", async () => {
    mockFindRepoRoot.mockImplementation(async (startPath: string) =>
      nestedRoot(startPath),
    );
    const presentation = {
      openBranchesDialog: vi.fn(async () => undefined),
    } as unknown as GitMenuPresentation;
    const uri = vscode.Uri.file("/repo/nested/src/app.ts") as vscode.Uri;

    await gitCheckoutBranch(uri, undefined, undefined, presentation);

    expect(presentation.openBranchesDialog).toHaveBeenCalledWith({
      workspaceRoot: "/repo/nested",
      repoRoot: "/repo/nested",
    });
  });

  it("gitCreateBranch forwards the resolved nested root to the presentation", async () => {
    mockFindRepoRoot.mockImplementation(async (startPath: string) =>
      nestedRoot(startPath),
    );
    const presentation = {
      openCreateBranchDialog: vi.fn(async () => undefined),
    } as unknown as GitMenuPresentation;
    const uri = vscode.Uri.file("/repo/nested/src/app.ts") as vscode.Uri;

    await gitCreateBranch(uri, undefined, undefined, presentation);

    expect(presentation.openCreateBranchDialog).toHaveBeenCalledWith({
      workspaceRoot: "/repo/nested",
      repoRoot: "/repo/nested",
    });
  });
});
