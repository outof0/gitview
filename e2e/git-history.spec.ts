/** E2E: Git History tab — commits, branch filter, diff preview. */
import { test, expect } from "@playwright/test";
import { loadRealFileLog, loadRealMergeDocument } from "./helpers/real-repo";
import { createGitService } from "../out/services/gitService";
import {
  buildStatusFixtureCommit,
  diffFixtureForStatus,
  installGitHistoryPage,
  type GitHistoryFixtures,
} from "./helpers/git-history";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "test-conflict-repo");
const git = createGitService();

let fixtures: GitHistoryFixtures;

test.beforeAll(async () => {
  const mergeDocument = await loadRealMergeDocument();
  const fileLog = await loadRealFileLog();
  const branches = await git.listBranches(repoRoot);
  const branchInfo = await git.getBranchInfo(repoRoot);
  const diffResult = await git.fileDiffAtCommit(
    repoRoot,
    fileLog.commits[0].sha,
    "file.txt",
    "M",
  );

  fixtures = {
    fileLog,
    branches,
    currentBranch: branchInfo.currentBranch,
    diff: diffResult.ok ? diffResult.diff : null,
    repoRoot,
  };

  void mergeDocument;
});

test("History tab — commits, branch filter, diff preview", async ({
  page,
}) => {
  await installGitHistoryPage(page, fixtures);

  const toolWindow = page.getByTestId("git-history-tool-window");
  await expect(toolWindow).toContainText("History: file.txt");
  await expect(page.getByTestId("git-commit-list")).toBeVisible();
  await expect(toolWindow).toContainText(fixtures.fileLog.subjectSample);
  await expect(page.getByTestId("git-diff-preview")).toBeVisible({
    timeout: 5000,
  });
});

test("branch filter sends log.query with the selected branch", async ({
  page,
}) => {
  const { posted } = await installGitHistoryPage(page, fixtures);

  const otherBranch =
    fixtures.branches.find((b) => b !== fixtures.currentBranch) ??
    fixtures.branches[0];
  await page.getByTestId("git-history-branch-filter").selectOption(otherBranch);

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "log.query" &&
          (m.payload as { branch?: string }).branch === otherBranch,
      ),
    )
    .toBe(true);
});

test("search filters commits by subject", async ({ page }) => {
  await installGitHistoryPage(page, fixtures);

  const needle = fixtures.fileLog.subjectSample.slice(0, 8);
  await page.getByTestId("git-history-search").fill(needle);
  await expect(page.getByTestId("git-commit-list")).toContainText(needle);

  await page.getByTestId("git-history-search").fill("zzzz-no-match-zzzz");
  await expect(page.getByTestId("git-history-tool-window")).toContainText(
    "No commits touched this file",
  );
});

test("commit selection loads changed files and requests a file patch", async ({
  page,
}) => {
  const { posted } = await installGitHistoryPage(page, fixtures);
  const commits = fixtures.fileLog.commits;
  expect(commits.length).toBeGreaterThan(0);

  const target = commits[Math.min(1, commits.length - 1)];
  await page
    .getByTestId(`git-commit-${target.shortSha}`)
    .click();

  await expect(page.getByTestId("git-changed-files-tree")).toBeVisible();
  const changedFile = target.changedFiles[0]?.path;
  expect(changedFile).toBeTruthy();

  await page.getByTestId(`changed-files-file-${changedFile}`).click();

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "log.fileDiff" &&
          (m.payload as { sha: string; path: string }).sha === target.sha &&
          (m.payload as { path: string }).path === changedFile,
      ),
    )
    .toBe(true);

  await expect(page.getByTestId("git-diff-preview")).toBeVisible();
});

test("changed-file context menu Get from Revision posts git.menuAction", async ({
  page,
}) => {
  const { posted } = await installGitHistoryPage(page, fixtures);
  const commit = fixtures.fileLog.commits[0];
  const filePath = commit.changedFiles[0]?.path ?? "file.txt";

  await page
    .getByTestId(`git-commit-${commit.shortSha}`)
    .click();
  await page.getByTestId(`changed-files-file-${filePath}`).click({
    button: "right",
  });
  await page.getByTestId("git-history-file-menu-get-revision").click();

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "git.menuAction" &&
          (m.payload as { action: string }).action === "getFromRevision" &&
          (m.payload as { relativePath: string }).relativePath === filePath,
      ),
    )
    .toBe(true);
});

test("refresh reloads history and keeps the active branch filter", async ({
  page,
}) => {
  const { posted } = await installGitHistoryPage(page, fixtures);
  const otherBranch =
    fixtures.branches.find((b) => b !== fixtures.currentBranch) ??
    fixtures.branches[0];

  await page.getByTestId("git-history-branch-filter").selectOption(otherBranch);
  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "log.query" &&
          (m.payload as { branch?: string }).branch === otherBranch,
      ),
    )
    .toBe(true);

  const beforeRefresh = posted.length;
  await page.getByTestId("git-history-search").fill(fixtures.fileLog.subjectSample.slice(0, 6));
  await page.getByTestId("git-history-refresh").click();

  await expect
    .poll(() =>
      posted.slice(beforeRefresh).some(
        (m) =>
          m.type === "log.query" &&
          (m.payload as { path: string }).path === "file.txt" &&
          (m.payload as { branch?: string }).branch === otherBranch,
      ),
    )
    .toBe(true);

  await expect(page.getByTestId("git-history-branch-filter")).toHaveValue(
    otherBranch,
  );
  await expect(page.getByTestId("git-commit-list")).toContainText(
    fixtures.fileLog.subjectSample.slice(0, 6),
  );
});

test("Ctrl+D opens full diff viewer for the selected changed file", async ({
  page,
}) => {
  // GitView behavior this protects: Ctrl+D opens Differences Viewer, not inline preview.
  const { posted } = await installGitHistoryPage(page, fixtures);
  const commit = fixtures.fileLog.commits[0];
  const filePath = commit.changedFiles[0]?.path ?? "file.txt";

  await page
    .getByTestId(`git-commit-${commit.shortSha}`)
    .click();
  await page.getByTestId(`changed-files-file-${filePath}`).click();
  const patchCountBefore = posted.filter((m) => m.type === "log.fileDiff").length;

  await page.keyboard.press("Control+d");

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "git.menuAction" &&
          (m.payload as { action: string }).action === "showRevisionDiff" &&
          (m.payload as { commitSha: string }).commitSha === commit.sha &&
          (m.payload as { relativePath: string }).relativePath === filePath,
      ),
    )
    .toBe(true);
  expect(posted.filter((m) => m.type === "log.fileDiff").length).toBe(
    patchCountBefore,
  );
});

test("Show Diff from file context menu opens full diff viewer", async ({
  page,
}) => {
  // GitView behavior this protects: Show Diff opens Differences Viewer, not preview reload.
  const { posted } = await installGitHistoryPage(page, fixtures);
  const commit = fixtures.fileLog.commits[0];
  const filePath = commit.changedFiles[0]?.path ?? "file.txt";

  await page
    .getByTestId(`git-commit-${commit.shortSha}`)
    .click();
  await page.getByTestId(`changed-files-file-${filePath}`).click({
    button: "right",
  });
  const patchCountBefore = posted.filter((m) => m.type === "log.fileDiff").length;

  await page.getByTestId("git-history-file-menu-show-diff").click();

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "git.menuAction" &&
          (m.payload as { action: string }).action === "showRevisionDiff" &&
          (m.payload as { commitSha: string }).commitSha === commit.sha &&
          (m.payload as { relativePath: string }).relativePath === filePath,
      ),
    )
    .toBe(true);
  expect(posted.filter((m) => m.type === "log.fileDiff").length).toBe(
    patchCountBefore,
  );
});

test("selecting a changed file requests inline diff preview", async ({
  page,
}) => {
  const { posted } = await installGitHistoryPage(page, fixtures);
  const commit = fixtures.fileLog.commits[0];
  const filePath = commit.changedFiles[0]?.path ?? "file.txt";

  await page
    .getByTestId(`git-commit-${commit.shortSha}`)
    .click();
  await page.getByTestId(`changed-files-file-${filePath}`).click();

  await expect
    .poll(() => posted.some((m) => m.type === "log.fileDiff"))
    .toBe(true);
  await expect(page.getByTestId("git-diff-preview")).toBeVisible();
});

test("Compare with Local posts git.menuAction with commit and path", async ({
  page,
}) => {
  const { posted } = await installGitHistoryPage(page, fixtures);
  const commit = fixtures.fileLog.commits[0];

  await page
    .getByTestId(`git-commit-${commit.shortSha}`)
    .click({ button: "right" });
  await page.getByTestId("git-history-menu-compare-local").click();

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "git.menuAction" &&
          (m.payload as { action: string }).action === "compareWithLocal" &&
          (m.payload as { relativePath: string }).relativePath === "file.txt" &&
          (m.payload as { commitSha: string }).commitSha === commit.sha,
      ),
    )
    .toBe(true);
});

test("changed-file statuses render with correct labels", async ({
  page,
}) => {
  const sha = "abc1234567890abcdef1234567890abcdef12345";
  const statusCommit = buildStatusFixtureCommit(sha);
  const statusFixtures: GitHistoryFixtures = {
    ...fixtures,
    fileLog: {
      commits: [statusCommit],
      subjectSample: statusCommit.subject,
    },
    diff: null,
    diffByPath: {
      "added.txt": diffFixtureForStatus("A"),
      "modified.txt": diffFixtureForStatus("M"),
      "deleted.txt": diffFixtureForStatus("D"),
      "renamed.txt": diffFixtureForStatus("R"),
      "copied.txt": diffFixtureForStatus("C"),
      "binary.dat": diffFixtureForStatus("M", true),
    },
  };

  await installGitHistoryPage(page, statusFixtures);
  await page
    .getByTestId(`git-commit-${statusCommit.shortSha}`)
    .click();

  const cases = [
    { path: "added.txt", badge: "A" },
    { path: "modified.txt", badge: "M" },
    { path: "deleted.txt", badge: "D" },
    { path: "renamed.txt", badge: "R" },
    { path: "copied.txt", badge: "C" },
    { path: "binary.dat", badge: "M" },
  ] as const;

  for (const c of cases) {
    const row = page.getByTestId(`changed-files-file-${c.path}`);
    await expect(row).toContainText(c.badge);
    await row.click();
    await expect(page.getByTestId("git-diff-preview")).toBeVisible();
  }
});

test("empty history shows an actionable empty state", async ({ page }) => {
  const emptyFixtures: GitHistoryFixtures = {
    ...fixtures,
    fileLog: { commits: [], subjectSample: "" },
  };
  await installGitHistoryPage(page, emptyFixtures);

  await expect(page.getByTestId("git-history-tool-window")).toContainText(
    "No commits touched this file",
  );
});

test("git log error is visible in the tool window", async ({ page }) => {
  await installGitHistoryPage(page, fixtures, {
    logError: "Repository is not readable.",
  });

  await page.getByTestId("git-history-refresh").click();
  await expect(page.getByTestId("git-history-tool-window")).toContainText(
    "Repository is not readable.",
  );
});


test("stale log.snapshot for a different path is ignored in the browser", async ({
  page,
}) => {
  await installGitHistoryPage(page, fixtures);
  const subject = fixtures.fileLog.subjectSample;

  await page.getByTestId("git-history-refresh").click();
  await page.evaluate(
    (payload) => window.postMessage(payload, "*"),
    {
      protocolVersion: 1,
      type: "log.snapshot",
      payload: {
        repoId: "e2e-repo",
        branch: fixtures.currentBranch,
        refreshedAt: Date.now(),
        filters: { path: "other/file.ts" },
        commits: [
          {
            sha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            shortSha: "deadbee",
            author: "Stale",
            authorEmail: "stale@example.com",
            authorTime: 1,
            subject: "Stale path result",
            changedFiles: [],
          },
        ],
      },
    },
  );

  await page.waitForTimeout(300);
  await expect(page.getByTestId("git-commit-list")).toContainText(subject);
  await expect(page.getByTestId("git-commit-list")).not.toContainText(
    "Stale path result",
  );
});

test("stale log.snapshot for a different branch filter is ignored", async ({
  page,
}) => {
  const otherBranch =
    fixtures.branches.find((b) => b !== fixtures.currentBranch) ??
    fixtures.branches[0];
  await installGitHistoryPage(page, fixtures);

  await page.getByTestId("git-history-branch-filter").selectOption(otherBranch);
  await expect(page.getByTestId("git-commit-list")).toContainText(
    fixtures.fileLog.subjectSample,
    { timeout: 10_000 },
  );
  await page.evaluate(
    (payload) => window.postMessage(payload, "*"),
    {
      protocolVersion: 1,
      type: "log.snapshot",
      payload: {
        repoId: "e2e-repo",
        branch: fixtures.currentBranch,
        refreshedAt: Date.now(),
        filters: { path: "file.txt", branch: fixtures.currentBranch },
        commits: [
          {
            sha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            shortSha: "deadbee",
            author: "Stale",
            authorEmail: "stale@example.com",
            authorTime: 1,
            subject: "Stale branch result",
            changedFiles: [],
          },
        ],
      },
    },
  );

  await page.waitForTimeout(300);
  await expect(page.getByTestId("git-commit-list")).not.toContainText(
    "Stale branch result",
  );
});

test("folder history uses folder title and path payload", async ({ page }) => {
  const { posted } = await installGitHistoryPage(page, fixtures);

  await page.evaluate(
    (payload) => window.postMessage(payload, "*"),
    {
      protocolVersion: 1,
      type: "history.init",
      payload: {
        path: "src",
        isFolder: true,
        repoId: "e2e-repo",
        branches: fixtures.branches,
        currentBranch: fixtures.currentBranch,
      },
    },
  );
  await page.evaluate(
    (payload) => window.postMessage(payload, "*"),
    {
      protocolVersion: 1,
      type: "log.snapshot",
      payload: {
        repoId: "e2e-repo",
        branch: fixtures.currentBranch,
        refreshedAt: Date.now(),
        filters: { path: "src", isFolder: true },
        commits: fixtures.fileLog.commits,
      },
    },
  );

  await expect(page.getByTestId("git-history-tool-window")).toContainText(
    "History: src/",
  );

  await expect
    .poll(() =>
      posted.some(
        (m) =>
          m.type === "log.query" &&
          (m.payload as { path: string; isFolder: boolean }).path === "src" &&
          (m.payload as { isFolder: boolean }).isFolder === true,
      ),
    )
    .toBe(true);
});