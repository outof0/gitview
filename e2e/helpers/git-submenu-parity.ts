/**
 * GitView Git context-menu coverage helpers (spec §7 — Explorer / Editor / SCM).
 *
 * Every assertion verifies an observable outcome: diff content, blame rows,
 * Git index state, disk content, or a populated History surface. Posting
 * git:menuAction alone is never sufficient.
 */
import { expect, type Page } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { GitMenuWebviewAction } from "../../src/types/gitMenu";
import { git, isPathStaged, readRepoFile, waitForGit } from "./git-actions";
import { revealDiffText } from "./git-screen-parity";

/** Expected Git submenu entries for Explorer file actions. */
export const REFERENCE_FILE_GIT_ACTIONS = [
  { testId: "git-menu-show-history", action: "showHistory" as const },
  { testId: "git-menu-compare-revision", action: "compareWithRevision" as const },
  { testId: "git-menu-compare-branch", action: "compareWithBranch" as const },
  { testId: "git-menu-show-diff", action: "showDiff" as const },
  { testId: "git-menu-annotate", action: "annotateBlame" as const },
  { testId: "git-menu-rollback", action: "rollback" as const },
  { testId: "git-menu-add", action: "add" as const },
  { testId: "git-menu-unstage", action: "unstage" as const },
] as const;

export type ReferenceGitAction = (typeof REFERENCE_FILE_GIT_ACTIONS)[number]["action"];

export async function clickGitMenuItem(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
}

type GitEffectPeek = {
  type?: string;
  relativePath?: string;
  path?: string;
  lines?: unknown[];
  commits?: unknown[];
  title?: string;
  diff?: { left?: { text?: string }; right?: { text?: string } };
};

async function peekGitEffect(page: Page): Promise<GitEffectPeek | null> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __gitviewPeekGitEffect?: () => GitEffectPeek | null;
      }
    ).__gitviewPeekGitEffect?.() ?? null,
  );
}

export async function expectDiffPreviewOverlay(
  page: Page,
  opts: { contains?: string[]; titlePart?: string } = {},
): Promise<void> {
  const overlay = page.getByTestId("git-diff-preview-overlay");
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  if (opts.titlePart) {
    await expect(overlay).toContainText(opts.titlePart);
  }
  for (const text of opts.contains ?? []) {
    await revealDiffText(page, text);
    await expect(overlay).toContainText(text);
  }
}

export async function expectDiffPreviewEffect(
  page: Page,
  relativePath: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const effect = await peekGitEffect(page);
      return (
        effect?.type === "diffPreview" && effect.relativePath === relativePath
      );
    })
    .toBe(true);
}

export async function expectBlameEffect(
  page: Page,
  relativePath: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const effect = await peekGitEffect(page);
      return (
        effect?.type === "blame" &&
        effect.relativePath === relativePath &&
        (effect.lines?.length ?? 0) > 0
      );
    })
    .toBe(true);
}

export async function expectBlameGutterRendered(
  page: Page,
  opts: {
    authorSample: string;
    shaSample: string;
    pane?: "left" | "right";
  },
): Promise<void> {
  const scope = opts.pane
    ? page.locator(`[data-testid="pane-${opts.pane}"]`)
    : page;
  await expect(page.locator(".nx-blame").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(scope).toContainText(opts.authorSample);
  await expect(scope).toContainText(opts.shaSample);
}

export async function expectHistorySurface(
  page: Page,
  targetPath: string,
): Promise<void> {
  await expect(page.getByTestId("git-history-tool-window")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("git-history-tool-window")).toContainText(
    `History: ${targetPath}`,
  );
  await expect(page.getByTestId("git-commit-list")).toBeVisible();
  await expect
    .poll(async () => {
      const effect = await peekGitEffect(page);
      return (effect?.commits?.length ?? 0) > 0;
    })
    .toBe(true);
}

export async function expectPathStaged(
  repoRoot: string,
  relativePath: string,
): Promise<void> {
  await waitForGit(async () => isPathStaged(repoRoot, relativePath));
}

export async function expectPathUnstaged(
  repoRoot: string,
  relativePath: string,
): Promise<void> {
  await waitForGit(async () => !(await isPathStaged(repoRoot, relativePath)));
}

export async function expectExactlyStaged(
  repoRoot: string,
  relativePaths: string[],
): Promise<void> {
  const expected = [...relativePaths].sort();
  await waitForGit(async () => {
    const indexed = await git(repoRoot, ["diff", "--cached", "--name-only"]);
    const staged = indexed.trim().split("\n").filter(Boolean).sort();
    return JSON.stringify(staged) === JSON.stringify(expected);
  });
}

export async function expectFileRestoredToHead(
  repoRoot: string,
  relativePath: string,
  headContent: string,
): Promise<void> {
  await waitForGit(async () => {
    const current = await readRepoFile(repoRoot, relativePath);
    return current === headContent;
  });
}

export async function readHeadBlob(
  repoRoot: string,
  relativePath: string,
): Promise<string> {
  try {
    return await git(repoRoot, ["show", `HEAD:${relativePath}`]);
  } catch {
    return "";
  }
}

export async function appendWorktreeLine(
  repoRoot: string,
  relativePath: string,
  marker: string,
): Promise<string> {
  const before = await readRepoFile(repoRoot, relativePath);
  await fs.mkdir(path.dirname(path.join(repoRoot, relativePath)), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(repoRoot, relativePath),
    `${before}\n${marker}\n`,
    "utf8",
  );
  return before;
}

export async function writeUntrackedFile(
  repoRoot: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absolute = path.join(repoRoot, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
}

/** Restore a tracked repository file without deleting it from disk. */
export async function restoreTrackedFile(
  repoRoot: string,
  relativePath: string,
): Promise<void> {
  await git(repoRoot, ["reset", "--", relativePath]).catch(() => "");
  await git(repoRoot, ["checkout", "HEAD", "--", relativePath]).catch(() => "");
}

/** Remove ephemeral paths created only for E2E assertions. */
export async function removeTestArtifacts(
  repoRoot: string,
  relativePaths: string[],
): Promise<void> {
  for (const relativePath of relativePaths) {
    await git(repoRoot, ["reset", "--", relativePath]).catch(() => "");
    await fs.rm(path.join(repoRoot, relativePath), {
      recursive: true,
      force: true,
    });
  }
}

/** Workflow rule: Show Diff must surface HEAD ↔ working tree delta for the scoped file. */
export async function runShowDiffParity(
  page: Page,
  relativePath: string,
  marker: string,
): Promise<void> {
  await clickGitMenuItem(page, "git-menu-show-diff");
  await expectDiffPreviewEffect(page, relativePath);
  await expectDiffPreviewOverlay(page, {
    titlePart: "HEAD",
    contains: [marker],
  });
}

/** Workflow rule: Compare with Revision must pick a revision and show a diff. */
export async function runCompareRevisionParity(page: Page): Promise<void> {
  await clickGitMenuItem(page, "git-menu-compare-revision");
  await expectDiffPreviewOverlay(page, { titlePart: "Working Tree" });
}

/** Workflow rule: Compare with Branch must pick a branch and show a diff. */
export async function runCompareBranchParity(page: Page): Promise<void> {
  await clickGitMenuItem(page, "git-menu-compare-branch");
  await expectDiffPreviewOverlay(page, { titlePart: "Working Tree" });
}

/** Workflow rule: Annotate must show blame metadata for the scoped file. */
export async function runAnnotateParity(
  page: Page,
  relativePath: string,
  opts: {
    authorSample?: string;
    shaSample?: string;
    pane?: "left" | "right";
    /** Conflicts dialog has no merge blame gutter — verify effect only. */
    expectGutter?: boolean;
  } = {},
): Promise<void> {
  await clickGitMenuItem(page, "git-menu-annotate");
  await expectBlameEffect(page, relativePath);
  if (
    opts.expectGutter !== false &&
    opts.authorSample &&
    opts.shaSample
  ) {
    await expectBlameGutterRendered(page, {
      authorSample: opts.authorSample,
      shaSample: opts.shaSample,
      pane: opts.pane,
    });
  }
}

/** Workflow rule: Show History must open history scoped to the right-clicked path. */
export async function runShowHistoryParity(
  page: Page,
  targetPath: string,
): Promise<void> {
  await clickGitMenuItem(page, "git-menu-show-history");
  await expectHistorySurface(page, targetPath);
}

/** Workflow rule: Add stages the scoped path without sweeping unrelated untracked files. */
export async function runAddParity(
  page: Page,
  repoRoot: string,
  targetPath: string,
  decoyPath?: string,
): Promise<void> {
  await clickGitMenuItem(page, "git-menu-add");
  await expectPathStaged(repoRoot, targetPath);
  if (decoyPath) {
    const status = await git(repoRoot, [
      "status",
      "--porcelain=v1",
      "--",
      decoyPath,
    ]);
    expect(status.trim()).toMatch(/^\?\? /);
  }
}

/** Workflow rule: Unstage removes the scoped path while leaving other staged paths intact. */
export async function runUnstageParity(
  page: Page,
  repoRoot: string,
  targetPath: string,
  remainingStaged: string,
): Promise<void> {
  await clickGitMenuItem(page, "git-menu-unstage");
  await expectPathUnstaged(repoRoot, targetPath);
  await expectPathStaged(repoRoot, remainingStaged);
}

/** Workflow rule: Rollback discards working-tree edits for the scoped file. */
export async function runRollbackParity(
  page: Page,
  repoRoot: string,
  relativePath: string,
  headContent: string,
): Promise<void> {
  await clickGitMenuItem(page, "git-menu-rollback");
  await expectFileRestoredToHead(repoRoot, relativePath, headContent);
}

export function isInspectableGitAction(
  action: GitMenuWebviewAction,
): action is Exclude<
  GitMenuWebviewAction,
  "showHistory" | "showHistoryForFile"
> {
  return action !== "showHistory" && action !== "showHistoryForFile";
}
