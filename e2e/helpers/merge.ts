import { expect, type Page } from "@playwright/test";
import type { CompareMode } from "../../webview/src/stores/gitViewStore";
import { buildMergeDocument } from "../../out/core/mergeDocument";
import type { MergeDocument } from "../../src/core/types";
import type { GitViewSettings } from "../../src/types/settings";
import {
  installMockHost,
  setRoutedFixtures,
  type HostFixtures,
  type PostedHostMessage,
} from "./host";

/** Whitespace-only diff on line 2 for policy tests. */
export function buildWhitespaceDiffDoc(
  repoRoot: string,
  kind: "trailing" | "indent" = "trailing",
): MergeDocument {
  const base = "line1\nline2\nline3\n";
  const ours =
    kind === "trailing" ? "line1\nline2  \nline3\n" : "line1\n  line2\nline3\n";
  const theirs = base;
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/whitespace.ts",
    absolutePath: `${repoRoot}/src/whitespace.ts`,
    base,
    ours,
    theirs,
    worktree: ours,
  });
}

/** Intra-line word diff for highlighting mode tests. */
export function buildModifiedLineDoc(repoRoot: string): MergeDocument {
  const base = "a\nconst x = 1\nc\n";
  const ours = "a\nconst value = 1\nc\n";
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/words.ts",
    absolutePath: `${repoRoot}/src/words.ts`,
    base,
    ours,
    theirs: base,
    worktree: ours,
  });
}

const COMPARE_LABELS: Record<CompareMode, string> = {
  default: "Default (local vs base)",
  localBase: "Compare Local with Base",
  repoBase: "Compare Repository with Base",
  localRepo: "Compare Local with Repository",
  localMiddle: "Compare Local with Middle",
  repoMiddle: "Compare Repository with Middle",
};

export function sideRow(
  page: Page,
  side: "left" | "right",
  text: string | RegExp,
) {
  return page
    .locator(`[data-testid="pane-${side}"] .nx-row`)
    .filter({ hasText: text });
}

export async function setCompareMode(
  page: Page,
  mode: CompareMode,
): Promise<void> {
  await page.getByTitle("View options").click();
  await page
    .getByRole("menuitemradio", { name: COMPARE_LABELS[mode], exact: true })
    .click();
}

export async function setHighlightingMode(
  page: Page,
  mode: "lines" | "words" | "none",
): Promise<void> {
  const labels = {
    lines: "Highlight lines",
    words: "Highlight words",
    none: "Do not highlight",
  };
  await page.getByTitle("Highlighting policy").click();
  await page
    .getByRole("menuitemradio", { name: labels[mode], exact: true })
    .click();
}

export async function setWhitespacePolicy(
  page: Page,
  policy: "doNotIgnore" | "trimWhitespaces" | "ignoreWhitespaces",
): Promise<void> {
  const labels = {
    doNotIgnore: "Do not ignore",
    trimWhitespaces: "Trim whitespaces",
    ignoreWhitespaces: "Ignore whitespaces",
  };
  await page.getByTitle("Whitespace policy").click();
  await page
    .getByRole("menuitemradio", { name: labels[policy], exact: true })
    .click();
}

/** Classic 3-line conflict: a / b / c with ours vs theirs on line b. */
export function buildSimpleConflictDoc(
  overrides: Partial<{
    repoRoot: string;
    relativePath: string;
  }> = {},
): MergeDocument {
  const repoRoot = overrides.repoRoot ?? "/repo";
  const relativePath = overrides.relativePath ?? "src/app.ts";
  return buildMergeDocument({
    repoRoot,
    relativePath,
    absolutePath: `${repoRoot}/${relativePath}`,
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
  });
}

/** Tall file for scroll tests — unchanged regions collapse until expanded. */
export function buildTallConflictDoc(repoRoot: string): MergeDocument {
  const prefix = Array.from({ length: 30 }, (_, i) => `ctx${i}`).join("\n");
  const suffix = Array.from({ length: 30 }, (_, i) => `tail${i}`).join("\n");
  const mid = (center: string) => `${prefix}\n${center}\n${suffix}\n`;
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/long.ts",
    absolutePath: `${repoRoot}/src/long.ts`,
    base: mid("b"),
    ours: mid("ours"),
    theirs: mid("theirs"),
    worktree: mid("ours"),
  });
}

/** Force non-conflicting blocks back to unresolved (for toolbar apply tests). */
export function withUnresolvedNonConflicting(
  doc: MergeDocument,
): MergeDocument {
  const blocks = doc.blocks.map((b) =>
    b.kind === "ours_only" ||
    b.kind === "theirs_only" ||
    b.kind === "both_same"
      ? { ...b, status: "unresolved" as const }
      : b,
  );
  return { ...doc, blocks };
}

/** Two conflicts with shared findme base text for search/replace E2E. */
export function buildSearchReplaceDoc(repoRoot: string): MergeDocument {
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/search.ts",
    absolutePath: `${repoRoot}/src/search.ts`,
    base: "head\nfindme\nsep\nfindme\ntail\n",
    ours: "head\nlocal1\nsep\nlocal2\ntail\n",
    theirs: "head\nremote1\nsep\nremote2\ntail\n",
    worktree: "head\nlocal1\nsep\nlocal2\ntail\n",
  });
}

/** Single conflict with findme in the center for apply-payload search E2E. */
export function buildSearchReplaceSingleDoc(repoRoot: string): MergeDocument {
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/search-single.ts",
    absolutePath: `${repoRoot}/src/search-single.ts`,
    base: "head\nfindme\ntail\n",
    ours: "head\nlocal\ntail\n",
    theirs: "head\nremote\ntail\n",
    worktree: "head\nlocal\ntail\n",
  });
}

/** Mixed file: one both_same block and one real conflict on separate lines. */
export function buildMixedNonConflictingDoc(
  repoRoot: string,
): MergeDocument {
  const doc = buildMergeDocument({
    repoRoot,
    relativePath: "src/mixed.ts",
    absolutePath: `${repoRoot}/src/mixed.ts`,
    base: "top\nmid\nsep\nconf\nend\n",
    ours: "top\nboth\nsep\nours\nend\n",
    theirs: "top\nboth\nsep\ntheirs\nend\n",
    worktree: "top\nboth\nsep\nours\nend\n",
  });
  return withUnresolvedNonConflicting(doc);
}

/** Main Apply button — exact match avoids toolbar "Apply non-conflicting" buttons. */
export function applyButton(page: Page) {
  return page.getByRole("button", { name: "Apply", exact: true });
}

/** Multi-block TypeScript file: several conflicts plus non-conflicting edits. */
export function buildComplexConflictDoc(repoRoot: string): MergeDocument {
  const base = `import { defineConfig } from "vite";

export const server = {
  host: "127.0.0.1",
  port: 3000,
};

export function alpha(name: string) {
  return \`alpha:\${name}\`;
}

export function onlyLocal(value: number) {
  return value + 1;
}

export function beta(flag: boolean) {
  return flag ? "base-on" : "base-off";
}

export function onlyRemote(value: number) {
  return value - 1;
}

export function gamma() {
  return "base-gamma";
}

export const footer = "stable";
`;

  const ours = `import { defineConfig } from "vite";

export const server = {
  host: "localhost",
  port: 5173,
};

export function alpha(name: string) {
  return \`alpha-local:\${name.trim()}\`;
}

export function onlyLocal(value: number) {
  return value + 2;
}

export function beta(flag: boolean) {
  return flag ? "local-on" : "local-off";
}

export function onlyRemote(value: number) {
  return value - 1;
}

export function gamma() {
  return "local-gamma";
}

export const footer = "stable";
`;

  const theirs = `import { defineConfig } from "vite";

export const server = {
  host: "0.0.0.0",
  port: 8080,
};

export function alpha(name: string) {
  return \`alpha-remote:\${name.toUpperCase()}\`;
}

export function onlyLocal(value: number) {
  return value + 1;
}

export function beta(flag: boolean) {
  return flag ? "remote-on" : "remote-off";
}

export function onlyRemote(value: number) {
  return value - 2;
}

export function gamma() {
  return "remote-gamma";
}

export const footer = "stable";
`;

  return buildMergeDocument({
    repoRoot,
    relativePath: "src/complex.ts",
    absolutePath: `${repoRoot}/src/complex.ts`,
    base,
    ours,
    theirs,
    worktree: ours,
  });
}

export async function setupMergeFixtures(
  fixtures: HostFixtures,
): Promise<void> {
  (
    globalThis as unknown as { __MERGE_FIXTURES__: unknown }
  ).__MERGE_FIXTURES__ = fixtures;
  setRoutedFixtures(fixtures);
}

export async function installMergeHost(
  page: Page,
  fixtures: HostFixtures,
): Promise<void> {
  await installMockHost(page, fixtures);
}

/** Mock host that executes webview git:menuAction against the fixture repository. */
export async function installRealGitHost(
  page: Page,
  fixtures: HostFixtures,
  options: { openHistoryPageOnRequest?: boolean } = {},
): Promise<void> {
  await installMockHost(page, fixtures, {
    realGitRepoRoot: fixtures.mergeDocument.repoRoot,
    openHistoryPageOnRequest: options.openHistoryPageOnRequest,
  });
}

export async function openMergeResolver(
  page: Page,
  relativePath: string,
): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("text=Merging branch");
  await page.getByTestId(`conflicts-file-row-${relativePath}`).click();
  await page.click('button:has-text("Merge...")');
  await page.waitForSelector('[data-testid="pane-left"]');
  const center = page.locator('[data-testid="pane-center"]');
  await expect(center).toHaveAttribute("data-monaco-ready", "true", {
    timeout: 15_000,
  });
  await expect(center.locator(".monaco-editor .view-line").first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Swap global fixtures and reopen merge resolver (host already installed). */
export async function reopenMergeWithFixtures(
  page: Page,
  fixtures: HostFixtures,
  relativePath: string,
): Promise<void> {
  await setupMergeFixtures(fixtures);
  await openMergeResolver(page, relativePath);
}

export async function expandAllCollapsed(page: Page): Promise<void> {
  // Click the first banner repeatedly — the list mutates after each expand.
  for (let i = 0; i < 20; i++) {
    const banner = page.locator('[aria-label="expand-collapsed"]').first();
    if (!(await banner.isVisible())) {
      break;
    }
    await banner.click();
    await page.waitForTimeout(50);
  }
}

export async function wheelScrollPane(
  page: Page,
  pane: ReturnType<Page["locator"]>,
  deltaY = 500,
): Promise<{ before: number; after: number }> {
  const before = await pane.evaluate((el) => el.scrollTop);
  const monacoLine = pane.locator(".monaco-editor .view-line").first();
  if (await monacoLine.isVisible()) {
    await monacoLine.hover();
  } else {
    const box = await pane.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(150);
  const after = await pane.evaluate((el) => el.scrollTop);
  return { before, after };
}

export async function expectNoBlockingAlerts(page: Page): Promise<void> {
  await expect(page.locator("#toastContainer [role='alert']")).toHaveCount(0);
}

export async function getPostedMessages(
  page: Page,
): Promise<PostedHostMessage[]> {
  return page.evaluate(() =>
    (
      window as unknown as { __gitviewGetPosted: () => PostedHostMessage[] }
    ).__gitviewGetPosted(),
  );
}

export async function clearPostedMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as { __gitviewClearPosted: () => void }
    ).__gitviewClearPosted();
  });
}

export async function pushSettings(
  page: Page,
  partial: Partial<GitViewSettings>,
): Promise<void> {
  await page.evaluate(
    (settings) =>
      (
        window as unknown as {
          __gitviewPushSettings: (p: Partial<GitViewSettings>) => Promise<void>;
        }
      ).__gitviewPushSettings(settings),
    partial,
  );
}

export async function clickCenterMonacoLine(
  page: Page,
  lineText: string,
): Promise<void> {
  const line = page
    .locator('[data-testid="pane-center"] .monaco-editor .view-line')
    .filter({ hasText: lineText, exact: true });
  await expect(line.first()).toBeVisible({ timeout: 10_000 });
  await line.first().click();
}

export async function replaceCenterMonacoLine(
  page: Page,
  lineText: string,
  newText: string,
): Promise<void> {
  await clickCenterMonacoLine(page, lineText);
  // Select only the clicked line — Cmd+A would replace the whole result
  // document, which no longer belongs to the block under the cursor.
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.type(newText);
  await page.waitForTimeout(200);
}

export async function getCenterMonacoLines(page: Page): Promise<string[]> {
  const center = page.locator('[data-testid="pane-center"]');
  await expect(center).toHaveAttribute("data-monaco-ready", "true", {
    timeout: 10_000,
  });
  const lines = center.locator(".monaco-editor .view-line");
  await expect(lines.first()).toBeVisible({ timeout: 10_000 });
  return lines.evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
}

/** Accept the local side and ignore repository for the single-conflict fixture. */
/** Apply: host replies, resolver closes, file leaves the conflict list. */
export async function expectApplyFinishes(
  page: Page,
  relativePath: string,
): Promise<void> {
  await expect(page.getByTestId("pane-left")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("Merging branch")).toBeVisible();
  await expect(page.locator(`text=${relativePath}`)).toHaveCount(0);
}

/** Add/add (AA): empty base, both sides added different content. */
export function buildAddAddDoc(repoRoot: string): MergeDocument {
  return buildMergeDocument({
    repoRoot,
    relativePath: "edge/aa-file.ts",
    absolutePath: `${repoRoot}/edge/aa-file.ts`,
    base: "",
    ours: 'export const aa = "master-add";\n',
    theirs: 'export const aa = "feature-add";\n',
    worktree: 'export const aa = "master-add";\n',
    special: "add_add",
  });
}

/** UD (edge/du-file.ts): modified by local, deleted on repository. */
export function buildUdDoc(repoRoot: string): MergeDocument {
  const base = 'export const du = "base";\n';
  const ours = 'export const du = "master-modified";\n';
  return buildMergeDocument({
    repoRoot,
    relativePath: "edge/du-file.ts",
    absolutePath: `${repoRoot}/edge/du-file.ts`,
    base,
    ours,
    theirs: "",
    worktree: ours,
    special: "modify_delete",
  });
}

/** DU (edge/ud-file.ts): deleted by local, modified on repository. */
export function buildDuDoc(repoRoot: string): MergeDocument {
  const base = 'export const ud = "base";\n';
  const theirs = 'export const ud = "feature-modified";\n';
  return buildMergeDocument({
    repoRoot,
    relativePath: "edge/ud-file.ts",
    absolutePath: `${repoRoot}/edge/ud-file.ts`,
    base,
    ours: "",
    theirs,
    worktree: theirs,
    special: "delete_modify",
  });
}

/** Two conflicts separated by one unchanged line (close hunks). */
export function buildAdjacentHunksDoc(repoRoot: string): MergeDocument {
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/adjacent.ts",
    absolutePath: `${repoRoot}/src/adjacent.ts`,
    base: "head\nline2\nmid\nline4\ntail\n",
    ours: "head\nours2\nmid\nours4\ntail\n",
    theirs: "head\ntheirs2\nmid\ntheirs4\ntail\n",
    worktree: "head\nours2\nmid\nours4\ntail\n",
  });
}

/** Mixed LF and CRLF in stage content for banner tests. */
export function buildMixedEolDoc(repoRoot: string): MergeDocument {
  const mixed = "line1\r\nline2\nline3\r\n";
  return buildMergeDocument({
    repoRoot,
    relativePath: "src/mixed-eol.ts",
    absolutePath: `${repoRoot}/src/mixed-eol.ts`,
    base: "line1\nline2\nline3\n",
    ours: mixed,
    theirs: "line1\nline2\nline3\n",
    worktree: mixed,
  });
}

export async function resolveSimpleConflict(page: Page): Promise<void> {
  await page
    .locator('[data-testid="pane-left"]')
    .getByLabel("accept-left")
    .click();
  await page
    .locator('[data-testid="pane-right"]')
    .getByLabel("ignore")
    .click();
  await expect(applyButton(page)).toBeEnabled();
}
