import { expect, type Page } from "@playwright/test";
import { createGitService } from "../../out/services/gitService";
import type { BlameLine, FileDiffView } from "../../src/types/blame";
import {
  buildWorkingTreeDiff,
  E2E_REPO_ROOT,
} from "./git-actions";
import { E2E_PROTOCOL_VERSION, E2E_REPO_ID, v1Event, v1Response } from "./v1Protocol";

const git = createGitService();

export type BlameScreenBootstrap = {
  relativePath: string;
  repoId: string;
  lines: BlameLine[];
  headSha?: string | null;
  truncated?: boolean;
};

export type DiffScreenBootstrap = {
  relativePath: string;
  title: string;
  diff: FileDiffView;
};

export async function loadBlameScreenBootstrap(
  relativePath: string,
): Promise<BlameScreenBootstrap> {
  const result = await git.blameFile(E2E_REPO_ROOT, "HEAD", relativePath);
  if (!result.ok || result.lines.length === 0) {
    throw new Error(`blame bootstrap failed for ${relativePath}`);
  }
  const sample = result.lines[0]!;
  if (!sample.text?.trim()) {
    throw new Error(
      `blame lines missing source text for ${relativePath} — rebuild extension/webview`,
    );
  }
  let headSha: string | null = null;
  try {
    headSha = (
      await git.execGit(E2E_REPO_ROOT, ["rev-parse", "HEAD"])
    ).stdout.trim();
  } catch {
    headSha = result.lines[0]?.sha ?? null;
  }

  return {
    relativePath,
    repoId: E2E_REPO_ID,
    lines: result.lines,
    headSha,
    truncated: result.truncated,
  };
}

export async function loadDiffScreenBootstrap(
  relativePath: string,
  marker: string,
): Promise<DiffScreenBootstrap> {
  const diff = await buildWorkingTreeDiff(E2E_REPO_ROOT, relativePath);
  if (!diff.right?.text.includes(marker)) {
    throw new Error(`diff bootstrap missing marker "${marker}" in ${relativePath}`);
  }
  return {
    relativePath,
    title: `${relativePath} (HEAD ↔ Working Tree)`,
    diff,
  };
}

async function wireVsCodeApi(
  page: Page,
  route: (msg: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  await page.exposeFunction("__routeGitScreen", route);
  await page.addInitScript(() => {
    let acquired = false;
    (window as unknown as { __posted?: unknown[] }).__posted = [];
    window.acquireVsCodeApi = () => {
      if (acquired) {
        throw new Error("acquireVsCodeApi can only be called once");
      }
      acquired = true;
      return {
        postMessage: (msg: unknown) => {
          (
            window as unknown as { __posted?: unknown[] }
          ).__posted?.push(msg);
          void (
            window as unknown as { __routeGitScreen: (m: unknown) => void }
          ).__routeGitScreen(msg as Record<string, unknown>);
        },
        getState: () => null,
        setState: () => {},
      };
    };
  });
}

export async function openGitBlameScreen(
  page: Page,
  bootstrap: BlameScreenBootstrap,
): Promise<void> {
  const repoId = bootstrap.repoId ?? E2E_REPO_ID;
  const blameBootstrap = { ...bootstrap, repoId };

  await wireVsCodeApi(page, async (msg) => {
    if (msg.type === "webview.ready" && msg.protocolVersion === E2E_PROTOCOL_VERSION) {
      await page.evaluate(
        (args) => {
          window.postMessage(args.ready, "*");
          window.postMessage(args.preview, "*");
        },
        {
          ready: v1Response(String(msg.requestId), "webview.ready", {
            surface: "gitBlame",
            settings: {},
          }),
          preview: v1Event("blame.preview", blameBootstrap),
        },
      );
      return;
    }
    if (msg.type === "blame.query" && msg.protocolVersion === E2E_PROTOCOL_VERSION) {
      await page.evaluate(
        (args) => {
          window.postMessage(args.response, "*");
          window.postMessage(args.snapshot, "*");
        },
        {
          response: v1Response(String(msg.requestId), "blame.query", {
            repoId,
            filePath: bootstrap.relativePath,
            ref: "HEAD",
            lines: bootstrap.lines,
            refreshedAt: Date.now(),
          }),
          snapshot: v1Event("blame.snapshot", {
            repoId,
            filePath: bootstrap.relativePath,
            ref: "HEAD",
            lines: bootstrap.lines,
            refreshedAt: Date.now(),
          }),
        },
      );
      return;
    }
  });

  await page.addInitScript((payload) => {
    window.__GITVIEW_APP__ = "gitBlame";
    window.__GITVIEW_BOOTSTRAP__ = payload;
  }, bootstrap);

  await page.goto("/?app=gitBlame", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("git-blame-app")).toBeVisible({
    timeout: 15_000,
  });
}

export async function openGitDiffScreen(
  page: Page,
  bootstrap: DiffScreenBootstrap,
): Promise<void> {
  await wireVsCodeApi(page, async (msg) => {
    if (msg.type === "webview.ready" && msg.protocolVersion === 1) {
      await page.evaluate(
        (args) => {
          window.postMessage(
            {
              protocolVersion: 1,
              requestId: args.requestId,
              type: "webview.ready",
              ok: true,
              payload: { surface: "gitDiff", settings: {} },
            },
            "*",
          );
          window.postMessage(
            {
              protocolVersion: 1,
              type: "diff.preview",
              payload: args.preview,
            },
            "*",
          );
        },
        { requestId: msg.requestId, preview: bootstrap },
      );
    }
  });

  await page.addInitScript((payload) => {
    window.__GITVIEW_APP__ = "gitDiff";
    window.__GITVIEW_BOOTSTRAP__ = payload;
  }, bootstrap);

  await page.goto("/?app=gitDiff", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("git-diff-app")).toBeVisible({
    timeout: 15_000,
  });
}
