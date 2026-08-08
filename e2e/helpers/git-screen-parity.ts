/**
 * GitView Git screen coverage — annotate editor + Git Log tool window.
 */
import {
  expect,
  type ElectronApplication,
  type Frame,
  type Page,
} from "@playwright/test";
import {
  countBlameAnnotations,
  groupBlameBlocks,
  type BlameBlockLine,
} from "../../src/shared/lib/groupBlameBlocks";

type ScreenSurface = Frame | Page;
import {
  clickNativeGitMenu,
  type NativeVsCodeSession,
  waitForWebviewFrame,
} from "./native-vscode";

/**
 * Monaco only mounts rows near the viewport, so text at the end of a long file
 * is absent from the DOM until the editor scrolls down to it.
 */
export async function revealDiffText(
  surface: ScreenSurface,
  text: string,
): Promise<void> {
  if (!("mouse" in surface)) {
    return;
  }
  const split = surface.getByTestId("git-diff-split");
  const box = await split.boundingBox();
  if (!box) {
    return;
  }
  await surface.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  for (let i = 0; i < 20; i++) {
    if (((await split.textContent()) ?? "").includes(text)) {
      return;
    }
    await surface.mouse.wheel(0, 200);
    await surface.waitForTimeout(50);
  }
}

export async function expectGitViewScreen(
  surface: ScreenSurface,
  opts: {
    titlePart?: string;
    contains?: string[];
    requireSyntax?: boolean;
  } = {},
): Promise<void> {
  await expect(surface.getByTestId("git-diff-app")).toBeVisible({
    timeout: 15_000,
  });
  if (opts.titlePart) {
    await expect(surface.getByTestId("git-diff-app")).toContainText(
      opts.titlePart,
    );
  }
  for (const text of opts.contains ?? []) {
    await revealDiffText(surface, text);
    await expect(surface.getByTestId("git-diff-app")).toContainText(text);
  }
  await expect(surface.getByTestId("git-compare-toolbar")).toBeVisible();
  await expect(surface.getByTestId("git-diff-split")).toBeVisible();
  if (opts.requireSyntax) {
    await expectDiffSyntaxHighlight(surface);
  }
}

export async function expectGitViewBlameScreen(
  surface: ScreenSurface,
  opts: {
    relativePath?: string;
    authorSample?: string;
    shaSample?: string;
    contentSample?: string;
  } = {},
): Promise<void> {
  await expect(surface.getByTestId("git-blame-app")).toBeVisible({
    timeout: 15_000,
  });
  await expect(surface.getByTestId("workspace-blame-panel")).toBeVisible();
  await expect(surface.getByTestId("blame-editor")).toBeVisible();
  await expect(surface.getByTestId("blame-git-log-pane")).toBeVisible();
  await expect(surface.getByTestId("git-history-tool-window")).toBeVisible();
  if (opts.relativePath) {
    const fileName = opts.relativePath.split("/").pop() ?? opts.relativePath;
    await expect(surface.getByTestId("blame-editor-tab")).toContainText(
      fileName,
    );
  }
  if (opts.authorSample) {
    await expect(surface.getByTestId("blame-editor")).toContainText(
      opts.authorSample,
    );
  }
  if (opts.shaSample) {
    await expect(surface.getByTestId("blame-editor")).toContainText(
      opts.shaSample,
    );
  }
  if (opts.contentSample) {
    await expect(surface.getByTestId("blame-editor")).toContainText(
      opts.contentSample,
    );
  }
}

/**
 * compact blame: every line shows compact date + author labels.
 */
export async function expectBlameCompactBlockLayout(
  surface: ScreenSurface,
  lines: BlameBlockLine[],
): Promise<void> {
  const blocks = groupBlameBlocks(lines);

  await expect(surface.getByTestId(/^blame-sha-/)).toHaveCount(lines.length);
  await expect(surface.locator(".nx-blame-annotate--filler")).toHaveCount(0);

  const multiBlock = blocks.find((b) => b.lines.length > 1);
  if (multiBlock) {
    const second = multiBlock.lines[1]!;
    await expect(
      surface.getByTestId(`blame-sha-${second.lineNumber}`),
    ).toBeVisible();
    await expect(
      surface.getByTestId(`blame-sha-${second.lineNumber}`),
    ).toContainText(multiBlock.anchor.author);
    const anchor = surface.getByTestId(
      `blame-sha-${multiBlock.anchor.lineNumber}`,
    );
    await expect(anchor).toHaveAttribute(
      "data-block-lines",
      String(multiBlock.lines.length),
    );
  }

  if (lines.length >= 2) {
    const first = await surface.getByTestId("blame-line-1").boundingBox();
    const second = await surface.getByTestId("blame-line-2").boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first && second) {
      expect(Math.abs(first.height - second.height)).toBeLessThan(2);
      const gap = second.y - (first.y + first.height);
      expect(gap).toBeLessThan(2);
    }
  }

  const codeLine = lines.find((l) =>
    /(?:export|function|class|const|import)\b/.test(l.text ?? ""),
  );
  if (codeLine) {
    await expectBlameSyntaxHighlight(surface, codeLine.lineNumber, true);
  } else {
    await expectBlameSyntaxHighlight(surface, 1, false);
  }
  await expectBlameSingleScrollContainer(surface);
  await expectBlameDateFormat(surface, lines[0]!.authorTime);
}

export async function expectBlameDateFormat(
  surface: ScreenSurface,
  authorTimeSec: number,
): Promise<void> {
  const d = new Date(authorTimeSec * 1000);
  const expected = `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  await expect(surface.getByTestId(/^blame-sha-/).first()).toContainText(
    expected,
  );
}

export async function expectDiffSyntaxHighlight(
  surface: ScreenSurface,
): Promise<void> {
  const pane = surface.getByTestId("git-diff-split");
  await expect(pane).toBeVisible();
  // Split diffs render through Monaco (.view-line); whole-file add/delete uses
  // the custom HighlightedCodeLine renderer.
  await expect(
    pane
      .locator(
        '[data-testid="code-line"][data-language], .monaco-editor .view-line',
      )
      .first(),
  ).toBeVisible();
  await expect(
    pane
      .locator(
        '.syntax-keyword, .syntax-type, .syntax-string, .syntax-keyword2, [class*="mtk"]',
      )
      .first(),
  ).toBeVisible();
}

export async function expectBlameSyntaxHighlight(
  surface: ScreenSurface,
  lineNumber = 1,
  requireTypedTokens = false,
): Promise<void> {
  // Monaco-backed annotate editor
  const monaco = surface.getByTestId("blame-monaco");
  await expect(monaco).toBeVisible();
  await expect(monaco).toHaveAttribute("data-language", /.+/);
  await expect(surface.getByTestId("blame-editor")).toHaveAttribute(
    "data-monaco",
    "ready",
  );
  await expect(surface.getByTestId(`blame-line-${lineNumber}`)).toBeVisible();
  if (requireTypedTokens) {
    await expect(
      monaco
        .locator(
          '.mtk1, .mtk5, .mtk6, .mtk7, .mtk8, .mtk9, .mtk20, .syntax-keyword, .view-line span',
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(monaco.locator(".view-line, .monaco-editor").first()).toBeVisible();
  }
}

export async function expectBlameSingleScrollContainer(
  surface: ScreenSurface,
): Promise<void> {
  const cellOverflow = await surface
    .getByTestId("blame-editor")
    .evaluate(() => {
      const cells = Array.from(
        document.querySelectorAll<HTMLElement>(".nx-editor-annotate .nx-txt"),
      ).slice(0, 8);
      return cells.map((cell) => ({
        overflowX: getComputedStyle(cell).overflowX,
        hasOwnScroll: cell.scrollWidth > cell.clientWidth + 1,
      }));
    });
  for (const cell of cellOverflow) {
    expect(cell.overflowX).not.toBe("auto");
    expect(cell.overflowX).not.toBe("scroll");
    expect(cell.hasOwnScroll).toBe(false);
  }
}

export async function expectBlameCommitHistoryPanel(
  surface: ScreenSurface,
): Promise<void> {
  await expect(surface.getByTestId("git-history-tool-window")).toBeVisible({
    timeout: 15_000,
  });
  await expect(surface.getByTestId("git-commit-list")).toBeVisible();
}

export async function expectGitViewHistoryScreen(
  surface: ScreenSurface,
  targetPath: string,
): Promise<void> {
  await expect(surface.getByTestId("git-history-app")).toBeVisible({
    timeout: 15_000,
  });
  await expect(surface.getByTestId("history-git-log-pane")).toBeVisible();
  await expect(surface.getByTestId("git-history-tool-window")).toBeVisible();
  await expect(surface.getByTestId("git-history-tool-window")).toContainText(
    `History: ${targetPath}`,
  );
  await expect(surface.getByTestId("git-commit-list")).toBeVisible();
  // Log layout: commits | files + details.
  await expect(surface.getByTestId("git-history-log-body")).toHaveAttribute(
    "data-layout",
    "log",
  );
  await expect(surface.getByTestId("git-log-details-pane")).toBeVisible();
}

export async function expectBlameWebviewTab(
  page: Page,
  relativePath: string,
): Promise<void> {
  const fileName = relativePath.split("/").pop() ?? relativePath;
  await expect(
    page.getByRole("tab", { name: new RegExp(escapeRegex(fileName)) }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

/** Native Annotate: real VS Code editor tab for the file (not a webview code surface). */
export async function expectNativeAnnotateEditor(
  page: Page,
  relativePath: string,
): Promise<void> {
  const fileName = relativePath.split("/").pop() ?? relativePath;
  await expect(
    page.getByRole("tab", { name: new RegExp(escapeRegex(fileName)) }).first(),
  ).toBeVisible({ timeout: 15_000 });
  // Monaco editor body is present for normal file editing.
  await expect(page.locator(".monaco-editor").first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function expectHistoryWebviewTab(
  page: Page,
  fileName: string,
): Promise<void> {
  await expect(
    page.getByRole("tab", { name: new RegExp(escapeRegex(fileName)) }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

export async function expectDiffWebviewTab(
  page: Page,
  fileName: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const tabs = await page.locator(".tabs-container").first().innerText();
      return tabs.includes(fileName) && /↔|Working Tree|HEAD/.test(tabs);
    })
    .toBe(true);
}

export async function expectNoTextEditorTabFor(
  page: Page,
  fileName: string,
): Promise<void> {
  await expect
    .poll(async () => {
      const tabs = await page.locator(".tabs-container .tab").allInnerTexts();
      const plainEditorTabs = tabs.filter((label) => label.trim() === fileName);
      return plainEditorTabs.length === 0;
    })
    .toBe(true);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function waitForGitViewFrame(
  app: ElectronApplication,
  timeout = 60_000,
): Promise<Frame> {
  return waitForWebviewFrame(app, "git-diff-app", timeout);
}

export async function waitForGitViewBlameFrame(
  app: ElectronApplication,
  timeout = 60_000,
): Promise<Frame> {
  // Legacy webview blame surface (playground / fixtures). Native Annotate uses the real editor.
  return waitForWebviewFrame(app, "git-blame-app", timeout);
}

/** Git Log panel opened beside the real editor when Annotate runs. */
export async function waitForAnnotateLogFrame(
  app: ElectronApplication,
  timeout = 60_000,
): Promise<Frame> {
  return waitForWebviewFrame(app, "git-history-app", timeout);
}

export async function waitForGitViewHistoryFrame(
  app: ElectronApplication,
  timeout = 60_000,
): Promise<Frame> {
  return waitForWebviewFrame(app, "git-history-app", timeout);
}

export async function openExplorerGitAction(
  session: NativeVsCodeSession,
  resourceName: string,
  menuLabel: string,
): Promise<void> {
  await clickNativeGitMenu(session, resourceName, menuLabel);
}

export { countBlameAnnotations };
