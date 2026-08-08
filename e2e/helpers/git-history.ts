import { expect, type Page } from "@playwright/test";
import type {
  FileDiffView,
  GitChangedFile,
  GitCommitEntry,
} from "../../src/types/blame";
import type { WorkspaceDiffDocument } from "../../src/shared/types/diff";
import type { LogSnapshot } from "../../src/shared/types/log";
import {
  E2E_PROTOCOL_VERSION,
  E2E_REPO_ID,
  v1Event,
  v1Response,
} from "./v1Protocol";

export type GitHistoryFixtures = {
  fileLog: { commits: GitCommitEntry[]; subjectSample: string };
  branches: string[];
  currentBranch: string;
  repoRoot: string;
  repoId?: string;
  diff: FileDiffView | null;
  /** Optional per-path diff overrides for changed-file status tests. */
  diffByPath?: Record<string, FileDiffView>;
};

export type GitHistoryPageOptions = {
  captureMessages?: boolean;
  /** When set, log.query replies with this path (stale path E2E). */
  staleLogPath?: string;
  /** When set, log.snapshot uses this branch in payload (stale branch E2E). */
  staleLogBranch?: string;
  /** When true, log.query returns an error payload. */
  logError?: string;
  /** When true, log.fileDiff returns an error payload. */
  patchError?: string;
};

function buildLogSnapshot(
  fixtures: GitHistoryFixtures,
  opts: {
    path: string;
    branch?: string;
    isFolder?: boolean;
    scope?: "repo";
  },
): LogSnapshot {
  return {
    repoId: fixtures.repoId ?? E2E_REPO_ID,
    branch: opts.branch ?? fixtures.currentBranch,
    commits: fixtures.fileLog.commits,
    refreshedAt: Date.now(),
    filters: {
      path: opts.path,
      isFolder: opts.isFolder,
      scope: opts.scope,
      branch: opts.branch,
    },
  };
}

function diffToWorkspaceDocument(
  repoId: string,
  path: string,
  sha: string,
  diff: FileDiffView,
): WorkspaceDiffDocument {
  return {
    repoId,
    filePath: path,
    layout: diff.layout,
    status: diff.status,
    left: diff.left,
    right: diff.right,
    binary: Boolean(diff.binary),
    staged: false,
  };
}

export async function installGitHistoryPage(
  page: Page,
  fixtures: GitHistoryFixtures,
  options: GitHistoryPageOptions = {},
): Promise<{ posted: Array<{ type: string; payload?: unknown }> }> {
  const posted: Array<{ type: string; payload?: unknown }> = [];
  const pageErrors: string[] = [];
  const repoId = fixtures.repoId ?? E2E_REPO_ID;
  const historyPath = "file.txt";

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      pageErrors.push(msg.text());
    }
  });

  await page.addInitScript(
    (bootstrap) => {
      window.__GITVIEW_APP__ = "gitHistory";
      window.__GITVIEW_BOOTSTRAP__ = bootstrap;
      let acquired = false;
      window.acquireVsCodeApi = () => {
        if (acquired) {
          throw new Error("once");
        }
        acquired = true;
        return {
          postMessage: (msg: unknown) =>
            void (window as unknown as { __route: (m: unknown) => void }).__route(
              msg,
            ),
          getState: () => null,
          setState: () => {},
        };
      };
    },
    {
      path: historyPath,
      isFolder: false,
      repoId,
    },
  );

  await page.exposeFunction("__route", async (msg: Record<string, unknown>) => {
    if (options.captureMessages !== false) {
      posted.push(msg as { type: string; payload?: unknown });
    }

    if (
      msg.type === "webview.ready" &&
      msg.protocolVersion === E2E_PROTOCOL_VERSION
    ) {
      const initPayload = {
        path: historyPath,
        isFolder: false,
        repoId,
        branches: fixtures.branches,
        currentBranch: fixtures.currentBranch,
      };
      const snapshot = buildLogSnapshot(fixtures, {
        path: historyPath,
        branch: fixtures.currentBranch,
      });
      // When logError is set, skip the bootstrap snapshot so the first
      // log.query (and refresh) exercise the error path without a race.
      if (options.logError) {
        await page.evaluate(
          (args) => {
            window.postMessage(args.ready, "*");
            window.postMessage(args.init, "*");
          },
          {
            ready: v1Response(String(msg.requestId), "webview.ready", {
              surface: "gitHistory",
              settings: {},
            }),
            init: v1Event("history.init", initPayload),
          },
        );
        return;
      }
      await page.evaluate(
        (args) => {
          window.postMessage(args.ready, "*");
          window.postMessage(args.init, "*");
          window.postMessage(args.snapshot, "*");
        },
        {
          ready: v1Response(String(msg.requestId), "webview.ready", {
            surface: "gitHistory",
            settings: {},
          }),
          init: v1Event("history.init", initPayload),
          snapshot: v1Event("log.snapshot", snapshot),
        },
      );
      return;
    }

    if (
      msg.type === "log.fileAtRevision" &&
      msg.protocolVersion === E2E_PROTOCOL_VERSION
    ) {
      const sha = (msg.payload as { sha: string }).sha;
      const revPath = (msg.payload as { path: string }).path;
      await page.evaluate(
        (payload) => {
          window.postMessage(payload, "*");
        },
        v1Response(String(msg.requestId), "log.fileAtRevision", {
          sha,
          path: revPath,
          text: "# sample revision content\n",
        }),
      );
      return;
    }

    if (
      msg.type === "log.fileDiff" &&
      msg.protocolVersion === E2E_PROTOCOL_VERSION
    ) {
      const path = (msg.payload as { path: string }).path;
      const sha = (msg.payload as { sha: string }).sha;
      const diff =
        fixtures.diffByPath?.[path] ?? fixtures.diff ?? undefined;
      if (options.patchError) {
        await page.evaluate(
          (payload) => {
            window.postMessage(payload, "*");
          },
          {
            protocolVersion: E2E_PROTOCOL_VERSION,
            requestId: String(msg.requestId),
            type: "log.fileDiff",
            ok: false,
            error: { code: "GIT_ERROR", message: options.patchError },
          },
        );
        return;
      }
      if (diff) {
        const document = diffToWorkspaceDocument(repoId, path, sha, diff);
        await page.evaluate(
          (args) => {
            window.postMessage(args.response, "*");
            window.postMessage(args.event, "*");
          },
          {
            response: v1Response(String(msg.requestId), "log.fileDiff", document),
            event: v1Event("diff.result", document),
          },
        );
      }
      return;
    }

    if (
      msg.type === "log.query" &&
      msg.protocolVersion === E2E_PROTOCOL_VERSION
    ) {
      const query = msg.payload as {
        path?: string;
        branch?: string;
        isFolder?: boolean;
        scope?: "repo";
      };
      const path =
        options.staleLogPath ?? query.path ?? historyPath;
      const branch =
        options.staleLogBranch ?? query.branch ?? fixtures.currentBranch;

      if (options.logError) {
        await page.evaluate(
          (payload) => {
            window.postMessage(payload, "*");
          },
          {
            protocolVersion: E2E_PROTOCOL_VERSION,
            requestId: String(msg.requestId),
            type: "log.query",
            ok: false,
            error: { code: "GIT_ERROR", message: options.logError },
          },
        );
        return;
      }

      const snapshot = buildLogSnapshot(fixtures, {
        path,
        branch,
        isFolder: query.isFolder,
        scope: query.scope,
      });
      await page.evaluate(
        (args) => {
          window.postMessage(args.response, "*");
          window.postMessage(args.event, "*");
        },
        {
          response: v1Response(String(msg.requestId), "log.query", snapshot),
          event: v1Event("log.snapshot", snapshot),
        },
      );
    }
  });

  await page.goto("/?app=gitHistory", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("git-history-app")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("git-history-tool-window")).toBeVisible({
    timeout: 15_000,
  });

  const hasCommits = fixtures.fileLog.commits.length > 0;
  if (hasCommits && !options.logError) {
    await expect(page.getByTestId("git-commit-list")).toBeVisible({
      timeout: 15_000,
    });
  } else if (!hasCommits) {
    await expect(page.getByTestId("git-history-tool-window")).toContainText(
      /No commits touched this (file|folder)/,
    );
  }

  expect(pageErrors, "page errors during git history bootstrap").toEqual([]);

  return { posted };
}

/** Build a commit with varied changed-file statuses for status rendering tests. */
export function buildStatusFixtureCommit(sha: string): GitCommitEntry {
  const changedFiles: GitChangedFile[] = [
    { path: "added.txt", status: "A" },
    { path: "modified.txt", status: "M" },
    { path: "deleted.txt", status: "D" },
    { path: "renamed.txt", status: "R" },
    { path: "copied.txt", status: "C" },
    { path: "binary.dat", status: "M" },
  ];
  return {
    sha,
    shortSha: sha.slice(0, 7),
    author: "Test Author",
    authorEmail: "test@example.com",
    authorTime: 1_700_000_000,
    subject: "Status fixture commit",
    changedFiles,
  };
}

export function diffFixtureForStatus(
  status: GitChangedFile["status"],
  binary = false,
): FileDiffView {
  if (binary) {
    return { layout: "single", status: "M", left: null, right: null, binary: true };
  }
  switch (status) {
    case "A":
      return {
        layout: "single",
        status: "A",
        left: null,
        right: { label: "added.txt", text: "new content" },
      };
    case "D":
      return {
        layout: "single",
        status: "D",
        left: { label: "deleted.txt", text: "removed content" },
        right: null,
      };
    case "R":
      return {
        layout: "split",
        status: "R",
        left: { label: "old-name.txt", text: "before rename" },
        right: { label: "renamed.txt", text: "after rename" },
      };
    case "C":
      return {
        layout: "single",
        status: "C",
        left: null,
        right: { label: "copied.txt", text: "copied content" },
      };
    default:
      return {
        layout: "split",
        status: "M",
        left: { label: "before", text: "old line" },
        right: { label: "after", text: "new line" },
      };
  }
}