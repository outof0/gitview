/**
 * E2E — Git Blame: compact blame editor + Git Log tool window.
 */
import { test, expect } from "@playwright/test";
import { countBlameAnnotations } from "../src/shared/lib/groupBlameBlocks";
import {
  loadBlameScreenBootstrap,
  loadHistoryScreenBootstrap,
  openGitBlameScreen,
} from "./helpers/git-screen-bootstrap";
import {
  expectBlameCommitHistoryPanel,
  expectBlameCompactBlockLayout,
  expectGitViewBlameScreen,
} from "./helpers/git-screen-parity";

const TARGET = "services.ts";
const MULTI_LINE_TARGET = "src/utils/helpers.ts";

test.describe("Git Blame screen — compact layout", () => {
  test("every line shows compact date and author annotation", async ({
    page,
  }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    const sample =
      bootstrap.lines.find((l) => l.text?.includes("class")) ??
      bootstrap.lines[0]!;

    await openGitBlameScreen(page, bootstrap);

    await expectGitViewBlameScreen(page, {
      relativePath: TARGET,
      authorSample: sample.author,
      contentSample: "class",
    });
    await expectBlameCompactBlockLayout(page, bootstrap.lines);
    await expect(page.getByTestId("blame-sha-1")).toContainText(sample.author);
    await expect(page.getByTestId("blame-sha-1")).toContainText(
      sample.summary,
    );
    await expect(page.getByTestId(/^blame-sha-/)).toHaveCount(
      bootstrap.lines.length,
    );
  });

  test("multi-line commit block repeats compact annotation on every line", async ({
    page,
  }) => {
    const bootstrap = await loadBlameScreenBootstrap(MULTI_LINE_TARGET);
    expect(bootstrap.lines.length).toBeGreaterThan(3);

    await openGitBlameScreen(page, bootstrap);

    await expectGitViewBlameScreen(page, {
      relativePath: MULTI_LINE_TARGET,
      contentSample: "formatDate",
    });
    await expect(page.getByTestId("blame-editor")).toContainText("toISOString");
    await expectBlameCompactBlockLayout(page, bootstrap.lines);
    await expect(page.getByTestId(/^blame-sha-/)).toHaveCount(
      bootstrap.lines.length,
    );
    await expect(page.getByTestId("blame-sha-2")).toContainText(
      bootstrap.lines[1]!.author,
    );
    await expect(page.getByTestId("blame-sha-2")).toContainText(
      bootstrap.lines[1]!.summary,
    );
    await expect(page.locator(".nx-blame-annotate--filler")).toHaveCount(0);
  });

  test("clicking annotation loads full commit with all changed files", async ({
    page,
  }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    const history = await loadHistoryScreenBootstrap(TARGET);
    expect(history.commits.length).toBeGreaterThan(0);
    const head = history.commits[0]!;
    const fullCommit = {
      ...head,
      changedFiles: [
        ...(head.changedFiles ?? []),
        { path: "packages/other.ts", status: "M" as const },
        { path: "README.md", status: "M" as const },
      ],
    };

    await openGitBlameScreen(page, bootstrap, history, fullCommit);

    await page
      .getByTestId(/^blame-sha-/)
      .first()
      .click();
    await expectBlameCommitHistoryPanel(page);
    await expect(
      page.getByTestId("changed-files-file-packages/other.ts"),
    ).toBeVisible();
    await expect(
      page.getByTestId("changed-files-file-README.md"),
    ).toBeVisible();
  });

  test("clicking a changed file opens revision diff in a new tab", async ({
    page,
  }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    const history = await loadHistoryScreenBootstrap(TARGET);
    const head = history.commits[0]!;
    const fullCommit = {
      ...head,
      changedFiles: [
        { path: TARGET, status: "M" as const },
        { path: "README.md", status: "M" as const },
      ],
    };

    await openGitBlameScreen(page, bootstrap, history, fullCommit);
    await page
      .getByTestId(/^blame-sha-/)
      .first()
      .click();
    await page.getByTestId("changed-files-file-README.md").click();

    await expect
      .poll(async () => {
        const posted = await page.evaluate(() => {
          const api = (
            window as unknown as {
              __posted?: Array<{ type?: string; payload?: unknown }>;
            }
          ).__posted;
          return (
            api?.some(
              (m) =>
                m.type === "git.menuAction" &&
                (m.payload as { action?: string })?.action ===
                  "showRevisionDiff" &&
                (m.payload as { relativePath?: string })?.relativePath ===
                  "README.md" &&
                (m.payload as { reuseDiffPanel?: boolean })?.reuseDiffPanel !==
                  true &&
                (m.payload as { openInActiveColumn?: boolean })
                  ?.openInActiveColumn === true,
            ) ?? false
          );
        });
        return posted;
      })
      .toBe(true);
  });

  test("multiple commits show one anchor marker per block", async ({
    page,
  }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    expect(countBlameAnnotations(bootstrap.lines)).toBeGreaterThan(1);

    await openGitBlameScreen(page, bootstrap);
    await expect(page.locator("[data-block-lines]")).toHaveCount(
      countBlameAnnotations(bootstrap.lines),
    );
    await expect(page.getByTestId(/^blame-sha-/)).toHaveCount(
      bootstrap.lines.length,
    );
  });
});
