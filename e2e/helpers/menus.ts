import { expect, type Page } from "@playwright/test";
import type { GitMenuAction, GitMenuWebviewAction } from "../../src/types/gitMenu";
import {
  getGitSubmenuItems,
  isFileOnlyScope,
  type GitSubmenuRenderOptions,
} from "../../src/types/gitSubmenu";
import type { PostedHostMessage } from "./host";
import { applyButton } from "./merge";
import { getPostedMessages } from "./merge";

export type MergePaneSide = "left" | "right" | "center";

type GitSubmenuExpectOptions = GitSubmenuRenderOptions & {
  isFolder?: boolean;
};

/** Assert Git submenu rows match the shared manifest (order, label, disabled state). */
export async function expectGitSubmenu(
  page: Page,
  opts: GitSubmenuExpectOptions = {},
): Promise<void> {
  for (const item of getGitSubmenuItems(opts)) {
    const row = page.getByTestId(item.testId);
    await expect(row, item.title).toBeVisible();
    await expect(row).toContainText(item.title);
    if (opts.isFolder && isFileOnlyScope(item.scope)) {
      await expect(row).toHaveClass(/cursor-not-allowed/);
    }
  }
}

export async function openConflictBlockContextMenu(
  page: Page,
  side: "left" | "right",
  lineText: string,
): Promise<void> {
  const pane = page.locator(`[data-testid="pane-${side}"]`);
  await pane.getByText(lineText, { exact: true }).click({ button: "right" });
  await expect(page.getByTestId("merge-context-menu")).toBeVisible();
}

export async function openMergePaneGitMenu(
  page: Page,
  side: MergePaneSide,
  opts: { gutter?: boolean } = {},
): Promise<void> {
  const pane = page.locator(`[data-testid="pane-${side}"]`);
  if (opts.gutter && side !== "center") {
    await pane.locator(".nx-ln").first().click({ button: "right" });
  } else if (side === "center") {
    const line = pane.locator(".monaco-editor .view-line").first();
    await line.click({ button: "right" });
  } else {
    // Click row text — corner coords hit the line-number gutter and open a different menu.
    await pane.locator(".nx-block .nx-txt").first().click({ button: "right" });
  }
  await expect(page.getByTestId("merge-context-menu")).toBeVisible();
  await expect(page.getByTestId("git-menu-show-history")).toBeVisible();
}

export async function openMergeConflictGitMenu(
  page: Page,
  side: "left" | "right",
  lineText: string,
): Promise<void> {
  await openConflictBlockContextMenu(page, side, lineText);
}

/** Assert Git submenu items in the merge resolver context menu. */
export async function expectMergeGitSubmenu(
  page: Page,
  opts: { annotate?: boolean; gutterAnnotate?: boolean } = {},
): Promise<void> {
  const gutterAnnotate = opts.gutterAnnotate ?? false;

  if (gutterAnnotate) {
    await expect(
      page.getByTestId("editor-context-menu-annotate-gutter"),
    ).toBeVisible();
  } else {
    await expect(
      page.getByTestId("editor-context-menu-annotate-gutter"),
    ).toHaveCount(0);
  }

  await expectGitSubmenu(page, {
    showAnnotate: opts.annotate ?? true,
    isFolder: false,
  });
}

export async function expectGitBlamePosted(
  page: Page,
  side: "ours" | "theirs",
  relativePath: string,
): Promise<void> {
  // Protocol is blame.query { path, ref }; side is encoded as HEAD / MERGE_HEAD.
  const expectedRef = side === "theirs" ? "MERGE_HEAD" : "HEAD";
  await expect
    .poll(async () => {
      const posted = await getPostedMessages(page);
      return posted.some((m) => {
        if (m.type !== "blame.query") {
          return false;
        }
        const payload = m.payload as {
          path?: string;
          relativePath?: string;
          ref?: string;
          side?: string;
        };
        const pathOk =
          payload.path === relativePath ||
          payload.relativePath === relativePath;
        if (!pathOk) {
          return false;
        }
        // Accept legacy side field or current ref encoding.
        if (payload.side === side) {
          return true;
        }
        if (payload.ref === expectedRef || payload.ref === side) {
          return true;
        }
        // Default HEAD when ref omitted is only valid for ours.
        return side === "ours" && (payload.ref === undefined || payload.ref === "");
      });
    })
    .toBe(true);
}

export function conflictsFileRow(page: Page, relativePath: string) {
  return page.getByTestId(`conflicts-file-row-${relativePath}`);
}

export function conflictsFolderRow(page: Page, directory: string) {
  return page.getByTestId(`conflicts-folder-row-${directory}`);
}

export async function enableConflictsGroupedView(page: Page): Promise<void> {
  await page.getByLabel("Group files by directory").click();
}

export async function openConflictsFileContextMenu(
  page: Page,
  relativePath: string,
): Promise<void> {
  await conflictsFileRow(page, relativePath).click({ button: "right" });
  await expect(page.getByTestId("conflicts-context-menu")).toBeVisible();
}

export async function openConflictsFolderContextMenu(
  page: Page,
  directory: string,
): Promise<void> {
  await conflictsFolderRow(page, directory).click({ button: "right" });
  await expect(page.getByTestId("conflicts-context-menu")).toBeVisible();
}

/** @deprecated Use openConflictsFileContextMenu */
export async function openConflictListContextMenu(
  page: Page,
  relativePath: string,
): Promise<void> {
  await openConflictsFileContextMenu(page, relativePath);
}

export async function expectConflictsFileContextMenu(page: Page): Promise<void> {
  const menu = page.getByTestId("conflicts-context-menu");
  await expect(menu.getByText("Merge...")).toBeVisible();
  await expect(menu.getByTestId("conflicts-menu-accept-yours")).toBeVisible();
  await expect(menu.getByTestId("conflicts-menu-accept-theirs")).toBeVisible();
  await expectGitSubmenu(page, { isFolder: false });
}

export async function expectConflictsFolderContextMenu(page: Page): Promise<void> {
  const menu = page.getByTestId("conflicts-context-menu");
  await expect(menu.getByText("Merge...")).toHaveCount(0);
  await expect(menu.getByTestId("conflicts-menu-accept-yours")).toHaveCount(0);
  await expect(menu.getByTestId("conflicts-menu-accept-theirs")).toHaveCount(0);
  await expectGitSubmenu(page, { isFolder: true });
}

export async function expectHostMessagePosted(
  page: Page,
  type: string,
  match?: (payload: Record<string, unknown>) => boolean,
): Promise<void> {
  await expect
    .poll(async () => {
      const posted = await getPostedMessages(page);
      return posted.some((m) => {
        if (m.type !== type) {
          return false;
        }
        if (!match) {
          return true;
        }
        return match((m.payload ?? {}) as Record<string, unknown>);
      });
    })
    .toBe(true);
}

export async function clickContextMenuItem(
  page: Page,
  testId: string,
): Promise<void> {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId("merge-context-menu")).toHaveCount(0);
}

export async function expectConflictCounter(
  page: Page,
  pattern: RegExp | string,
): Promise<void> {
  await expect(page.locator('[data-testid="conflict-counter"]')).toContainText(
    pattern,
  );
}

export async function expectApplyEnabled(
  page: Page,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    await expect(applyButton(page)).toBeEnabled();
  } else {
    await expect(applyButton(page)).toBeDisabled();
  }
}

export async function expectCenterLine(
  page: Page,
  text: string,
  options?: { visible?: boolean },
): Promise<void> {
  const line = page
    .locator('[data-testid="pane-center"] .monaco-editor .view-line')
    .filter({ hasText: text, exact: true });
  if (options?.visible === false) {
    await expect(line).toHaveCount(0);
  } else {
    await expect(line.first()).toBeVisible();
  }
}

export async function expectResolveMenuItems(
  page: Page,
  visible: string[],
  hidden: string[] = [],
): Promise<void> {
  for (const id of visible) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  for (const id of hidden) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
}

/**
 * Low-level transport check only. Prefer git-submenu-parity helpers that
 * assert diff content, blame rows, git index, or disk outcomes.
 */
export async function expectGitMenuActionPosted(
  page: Page,
  action: GitMenuAction,
  opts: { relativePath?: string; isFolder?: boolean } = {},
): Promise<void> {
  await expect
    .poll(async () => {
      const posted = await getPostedMessages(page);
      return posted.some((m) => {
        if (m.type !== "git.menuAction") {
          return false;
        }
        const payload = m.payload as {
          action?: string;
          relativePath?: string;
          isFolder?: boolean;
        };
        if (payload.action !== action) {
          return false;
        }
        if (
          opts.relativePath !== undefined &&
          payload.relativePath !== opts.relativePath
        ) {
          return false;
        }
        if (
          opts.isFolder !== undefined &&
          payload.isFolder !== opts.isFolder
        ) {
          return false;
        }
        return true;
      });
    })
    .toBe(true);
}

export async function expectGitHistoryOpenPosted(
  page: Page,
  opts: { path: string; isFolder?: boolean },
): Promise<void> {
  await expect
    .poll(async () => {
      const posted = await getPostedMessages(page);
      return posted.some((m) => {
        if (m.type !== "history.openPanel") {
          return false;
        }
        const payload = m.payload as { path?: string; isFolder?: boolean };
        return (
          payload.path === opts.path &&
          (opts.isFolder === undefined || payload.isFolder === opts.isFolder)
        );
      });
    })
    .toBe(true);
}

export function lastGitMenuAction(
  posted: PostedHostMessage[],
  action: GitMenuWebviewAction,
): PostedHostMessage | undefined {
  return [...posted]
    .reverse()
    .find(
      (m) =>
        m.type === "git.menuAction" &&
        (m.payload as { action?: string }).action === action,
    );
}