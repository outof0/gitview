/**
 * E2E — Git Blame: compact blame editor + Git Log tool window.
 */
import { test, expect } from "@playwright/test";
import { countBlameAnnotations } from "../src/shared/lib/groupBlameBlocks";
import {
  loadBlameScreenBootstrap,
  openGitBlameScreen,
} from "./helpers/git-screen-bootstrap";
import {
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
    await expect(page.getByTestId("blame-sha-1")).not.toContainText(
      sample.summary,
    );
    await page.getByTestId("blame-sha-1").hover();
    await expect(page.getByTestId("blame-commit-hover-card")).toContainText(
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
    await expect(page.getByTestId("blame-sha-2")).not.toContainText(
      bootstrap.lines[1]!.summary,
    );
    await expect(page.locator(".nx-blame-annotate--filler")).toHaveCount(0);
  });

  test("clicking an annotation selects its commit in the Git workspace", async ({
    page,
  }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    await openGitBlameScreen(page, bootstrap);
    const expectedSha = bootstrap.lines[0]?.sha;
    await page
      .getByTestId(/^blame-sha-/)
      .first()
      .click();

    await expect
      .poll(async () => {
        const posted = await page.evaluate((expected) => {
          const api = (
            window as unknown as {
              __posted?: Array<{ type?: string; payload?: unknown }>;
            }
          ).__posted;
          return (
            api?.some(
              (m) =>
                m.type === "blame.selectCommit" &&
                (m.payload as { repoId?: string; sha?: string })?.repoId ===
                  expected.repoId &&
                (m.payload as { sha?: string })?.sha === expected.sha,
            ) ?? false
          );
        }, { repoId: bootstrap.repoId, sha: expectedSha });
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
