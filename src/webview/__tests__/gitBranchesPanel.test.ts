import { describe, it, expect, vi, beforeEach } from "vitest";
import { PROTOCOL_VERSION } from "../../shared/protocol";

const { createWebviewPanel, handleRawMessage } = vi.hoisted(() => ({
  createWebviewPanel: vi.fn(() => ({
    webview: {
      onDidReceiveMessage: vi.fn(),
      html: 'window.__GITVIEW_APP__="gitBranches"',
      postMessage: vi.fn(async () => true),
    },
    onDidDispose: vi.fn(),
    reveal: vi.fn(),
    dispose: vi.fn(),
  })),
  handleRawMessage: vi.fn(),
}));

vi.mock("vscode", () => ({
  window: { createWebviewPanel },
  workspace: { getConfiguration: () => ({ get: () => undefined }) },
  Uri: {
    joinPath: (...parts: string[]) => ({ path: parts.join("/") }),
  },
  ViewColumn: { Active: 1 },
}));

vi.mock("../getWebviewHtml", () => ({
  getWebviewHtml: vi.fn(
    async () => '<html><head></head><body>window.__GITVIEW_APP__="gitBranches"</body></html>',
  ),
}));

vi.mock("../gitViewPanelRouter", () => ({
  createGitViewPanelRouter: vi.fn(() => ({ handleRawMessage })),
}));

import { openGitBranchesPanel } from "../gitBranchesPanel";

type PanelStub = {
  webview: {
    onDidReceiveMessage: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    html: string;
  };
  onDidDispose: ReturnType<typeof vi.fn>;
  reveal: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

const context = {
  extensionUri: { path: "/ext" },
  subscriptions: [],
} as unknown as import("vscode").ExtensionContext;

const gitView = {
  logger: { warn: vi.fn() },
} as unknown as import("../../activation").GitViewContext;

function lastPanel(): PanelStub {
  const result = createWebviewPanel.mock.results.at(-1);
  if (!result) {
    throw new Error("createWebviewPanel was never called");
  }
  return result.value as unknown as PanelStub;
}

function registeredListener(target: ReturnType<typeof vi.fn>, what: string): unknown {
  const calls = target.mock.calls as unknown[][];
  const first = calls[0];
  if (!first) {
    throw new Error(`no ${what} listener was registered`);
  }
  return first[0];
}

function messageListener(): (message: unknown) => void {
  return registeredListener(
    lastPanel().webview.onDidReceiveMessage,
    "onDidReceiveMessage",
  ) as (message: unknown) => void;
}

function disposeListener(): () => void {
  return registeredListener(lastPanel().onDidDispose, "onDidDispose") as () => void;
}

function open(repoId: string): Promise<void> {
  return openGitBranchesPanel(context, gitView, { repoId, workspaceRoot: "/ws" });
}

describe("openGitBranchesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reveals the existing panel for a repository instead of opening a second one", async () => {
    await open("reuse-repo");
    await open("reuse-repo");

    expect(createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(lastPanel().reveal).toHaveBeenCalledOnce();
  });

  it("opens one panel per repository", async () => {
    await open("per-repo-a");
    await open("per-repo-b");

    expect(createWebviewPanel).toHaveBeenCalledTimes(2);
    expect(lastPanel().reveal).not.toHaveBeenCalled();
  });

  it("forgets a disposed panel so a later request opens a fresh one", async () => {
    await open("disposed-repo");
    disposeListener()();
    await open("disposed-repo");

    expect(createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it("answers the webview.ready handshake with its surface", async () => {
    await open("ready-repo");
    messageListener()({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "req-1",
      type: "webview.ready",
      payload: { surface: "gitBranches" },
    });

    const sent = lastPanel().webview.postMessage.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(sent).toHaveProperty("requestId", "req-1");
    expect(sent).toHaveProperty("type", "webview.ready");
    expect(sent).toHaveProperty("ok", true);
    expect(sent["payload"]).toEqual(
      expect.objectContaining({ surface: "gitBranches" }),
    );
  });

  it("closes the panel when the webview reports the popup was dismissed", async () => {
    await open("close-repo");
    messageListener()({ type: "git.branches.close" });

    expect(lastPanel().dispose).toHaveBeenCalledOnce();
    expect(handleRawMessage).not.toHaveBeenCalled();
  });

  it("routes every other message to the panel router", async () => {
    await open("route-repo");
    const message = { type: "branch.list" };
    messageListener()(message);

    expect(handleRawMessage).toHaveBeenCalledWith(message);
    expect(lastPanel().dispose).not.toHaveBeenCalled();
  });

  it("escapes the bootstrap payload so it cannot break out of the script tag", async () => {
    await openGitBranchesPanel(context, gitView, {
      repoId: "escape-repo",
      workspaceRoot: "/ws",
      initialRef: "</script><img src=x onerror=alert(1)>",
    });

    const html = lastPanel().webview.html;
    expect(html).toContain("window.__GITVIEW_BOOTSTRAP__=");
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
  });
});
