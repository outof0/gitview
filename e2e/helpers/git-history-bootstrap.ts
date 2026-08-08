import { expect, type Page } from "@playwright/test";
import type { HistoryBootstrap } from "./git-actions";
import {
  E2E_PROTOCOL_VERSION,
  E2E_REPO_ID,
  v1Event,
  v1Response,
} from "./v1Protocol";

export async function wireGitHistoryBootstrap(
  page: Page,
  bootstrap: HistoryBootstrap,
): Promise<void> {
  const repoId = bootstrap.repoId ?? E2E_REPO_ID;

  await page.exposeFunction("__routeHistory", async (msg: Record<string, unknown>) => {
    if (
      msg.type === "webview.ready" &&
      msg.protocolVersion === E2E_PROTOCOL_VERSION
    ) {
      const initPayload = {
        path: bootstrap.path,
        isFolder: bootstrap.isFolder,
        repoId,
        branches: bootstrap.branches,
        currentBranch: bootstrap.currentBranch,
      };
      const snapshot = {
        repoId,
        branch: bootstrap.currentBranch,
        commits: bootstrap.commits,
        refreshedAt: Date.now(),
        filters: {
          path: bootstrap.path,
          isFolder: bootstrap.isFolder,
        },
      };
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
      msg.type === "log.query" &&
      msg.protocolVersion === E2E_PROTOCOL_VERSION
    ) {
      const query = msg.payload as {
        path?: string;
        branch?: string;
        isFolder?: boolean;
      };
      const snapshot = {
        repoId,
        branch: query.branch ?? bootstrap.currentBranch,
        commits: bootstrap.commits,
        refreshedAt: Date.now(),
        filters: {
          path: query.path ?? bootstrap.path,
          isFolder: query.isFolder ?? bootstrap.isFolder,
          branch: query.branch,
        },
      };
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

  await page.addInitScript(
    (payload) => {
      window.__GITVIEW_APP__ = "gitHistory";
      window.__GITVIEW_BOOTSTRAP__ = payload;
      let acquired = false;
      window.acquireVsCodeApi = () => {
        if (acquired) {
          throw new Error("acquireVsCodeApi can only be called once");
        }
        acquired = true;
        return {
          postMessage: (msg: unknown) => {
            void (
              window as unknown as { __routeHistory: (m: unknown) => void }
            ).__routeHistory(msg);
          },
          getState: () => null,
          setState: () => {},
        };
      };
    },
    {
      path: bootstrap.path,
      isFolder: bootstrap.isFolder,
      repoId,
    },
  );
}

export async function openRealGitHistoryPage(
  page: Page,
  bootstrap: HistoryBootstrap,
): Promise<void> {
  await wireGitHistoryBootstrap(page, bootstrap);
  await page.goto("/?app=gitHistory", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("git-history-tool-window")).toBeVisible({
    timeout: 15_000,
  });
}