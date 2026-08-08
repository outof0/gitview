/**
 * E2E — Git Diff screen (standalone GitView compare panel).
 * GitView workflow coverage: inline diff viewer with HEAD ↔ Working Tree labels.
 */
import { test } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { E2E_REPO_ROOT } from "./helpers/git-actions";
import {
  loadDiffScreenBootstrap,
  openGitDiffScreen,
} from "./helpers/git-screen-bootstrap";
import { expectGitViewScreen } from "./helpers/git-screen-parity";

const TARGET = "file.txt";
const MARKER = "e2e diff screen marker";

test.describe("Git Diff screen — history compare", () => {
  test.beforeEach(async () => {
    const absolute = path.join(E2E_REPO_ROOT, TARGET);
    const before = await fs.readFile(absolute, "utf8").catch(() => "");
    await fs.writeFile(absolute, `${before}\n${MARKER}\n`, "utf8");
  });

  test.afterEach(async () => {
    await fs
      .writeFile(
        path.join(E2E_REPO_ROOT, TARGET),
        await fs
          .readFile(path.join(E2E_REPO_ROOT, TARGET), "utf8")
          .then((t) => t.replace(`\n${MARKER}\n`, "\n")),
        "utf8",
      )
      .catch(() => undefined);
  });

  test("shows split diff with working-tree delta", async ({ page }) => {
    const bootstrap = await loadDiffScreenBootstrap(TARGET, MARKER);
    await openGitDiffScreen(page, bootstrap);

    await expectGitViewScreen(page, {
      titlePart: "HEAD",
      contains: [MARKER, "Working Tree"],
    });
  });
});