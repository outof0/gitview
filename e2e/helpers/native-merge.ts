import {
  expect,
  type Frame,
  type Locator,
} from "@playwright/test";
import type { NativeVsCodeSession } from "./native-vscode";
import { openMergeResolver } from "./native-vscode";

/** DOM click — VS Code Chat panel can intercept Playwright pointer events. */
async function clickMergeMenuItem(frame: Frame, testId: string): Promise<void> {
  const item = frame.getByTestId(testId);
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.evaluate((el) => (el as HTMLElement).click());
}

/**
 * Open a context menu by dispatching on the element itself.
 * Playwright geometric right-click is often intercepted by sibling action
 * buttons (.nx-act) or overlapping chrome in the native VS Code webview.
 */
export async function dispatchContextMenu(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + Math.min(8, Math.max(1, rect.width / 2)),
        clientY: rect.top + Math.min(8, Math.max(1, rect.height / 2)),
        button: 2,
      }),
    );
  });
}

export type MergePaneSide = "left" | "right" | "center";

export async function openMergeResolverFor(
  session: NativeVsCodeSession,
  relativePath: string,
): Promise<Frame> {
  return openMergeResolver(session, relativePath);
}

export async function openMergeConflictContextMenu(
  frame: Frame,
  side: "left" | "right",
): Promise<void> {
  await dispatchContextMenu(
    frame
      .locator(
        `[data-testid="pane-${side}"] .nx-block[data-type="conflict"] .nx-txt`,
      )
      .first(),
  );
  await expect(frame.getByTestId("merge-context-menu")).toBeVisible();
}

export async function openMergeCenterContextMenu(
  frame: Frame,
  lineText: string,
): Promise<void> {
  const pane = frame.getByTestId("pane-center");
  // Single Result Monaco editor: pick a conflict line via view-line text
  // (block anchors are pointer-events:none overlays for scroll targets).
  const conflictLine = pane
    .locator(".monaco-editor .view-line")
    .filter({ hasText: lineText });
  await expect(conflictLine.first()).toBeVisible({ timeout: 15_000 });
  await dispatchContextMenu(conflictLine.first());
  await expect(frame.getByTestId("merge-context-menu")).toBeVisible();
}

export async function acceptLocalViaContextMenu(frame: Frame): Promise<void> {
  await dispatchContextMenu(
    frame
      .locator(
        '[data-testid="pane-left"] .nx-block[data-type="conflict"] .nx-txt',
      )
      .first(),
  );
  await clickMergeMenuItem(frame, "merge-context-accept-local");
}

export async function appendRepositoryViaContextMenu(frame: Frame): Promise<void> {
  await dispatchContextMenu(
    frame
      .locator(
        '[data-testid="pane-right"] .nx-block[data-type="conflict"] .nx-txt',
      )
      .first(),
  );
  await expect(frame.getByTestId("merge-context-menu")).toBeVisible();
  await clickMergeMenuItem(frame, "merge-context-append-repository");
  await expect(frame.getByTestId("merge-context-menu")).toHaveCount(0);
}

export async function clickMergeContextItem(
  frame: Frame,
  testId: string,
): Promise<void> {
  await clickMergeMenuItem(frame, testId);
  await expect(frame.getByTestId("merge-context-menu")).toHaveCount(0);
}

export async function expectCenterLine(
  frame: Frame,
  text: string,
  options?: { visible?: boolean },
): Promise<void> {
  const line = frame
    .locator('[data-testid="pane-center"] .monaco-editor .view-line')
    .filter({ hasText: text });
  if (options?.visible === false) {
    await expect(line).toHaveCount(0);
  } else {
    await expect(line.first()).toBeVisible({ timeout: 15_000 });
  }
}

export async function expectConflictCounter(
  frame: Frame,
  pattern: RegExp | string,
): Promise<void> {
  await expect(frame.getByTestId("conflict-counter")).toContainText(pattern);
}

export async function expectApplyEnabled(
  frame: Frame,
  enabled: boolean,
): Promise<void> {
  const apply = frame.getByTestId("merge-apply");
  if (enabled) {
    await expect(apply).toBeEnabled();
  } else {
    await expect(apply).toBeDisabled();
  }
}

export async function expectResolveMenuItems(
  frame: Frame,
  visible: string[],
  hidden: string[] = [],
): Promise<void> {
  for (const id of visible) {
    await expect(frame.getByTestId(id)).toBeVisible();
  }
  for (const id of hidden) {
    await expect(frame.getByTestId(id)).toHaveCount(0);
  }
}

export async function enableConflictsGroupedView(frame: Frame): Promise<void> {
  await frame.getByLabel("Group files by directory").click();
}

export async function openConflictsFolderContextMenu(
  frame: Frame,
  directory: string,
): Promise<void> {
  await frame.getByTestId(`conflicts-folder-row-${directory}`).click({
    button: "right",
  });
  await expect(frame.getByTestId("conflicts-context-menu")).toBeVisible();
}

export async function focusMergePane(
  page: Page,
  frame: Frame,
  side: MergePaneSide,
): Promise<void> {
  await frame.getByTestId(`pane-${side}`).click();
  await page.bringToFront();
}

export async function pressMergeShortcut(
  page: Page,
  frame: Frame,
  key: string,
): Promise<void> {
  await frame.getByTestId("pane-left").click();
  await page.bringToFront();
  await page.keyboard.press(key);
}

export async function waitForConflictsFrame(
  app: ElectronApplication,
): Promise<Frame> {
  return waitForWebviewFrame(app, "conflicts-file-row-file.txt");
}
