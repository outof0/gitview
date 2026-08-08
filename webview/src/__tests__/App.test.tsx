// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { buildMergeDocument } from "../../../src/core/mergeDocument";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { App } from "../App";
import { useGitViewStore } from "../stores/gitViewStore";
import { useBlameStore } from "../stores/blameStore";
import { setupMergeTestBootstrap } from "../test/mergeTestProviders";

function makeResolverDoc() {
  const doc = buildMergeDocument({
    repoRoot: "/r",
    relativePath: "src/a.ts",
    absolutePath: "/r/src/a.ts",
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
  });
  return { ...doc, dirty: true };
}

beforeEach(() => {
  setupMergeTestBootstrap("test-repo");
  useGitViewStore.setState({
    screen: "conflictList",
    conflictFiles: [
      { relativePath: "src/a.ts", stageCode: "UU" },
      { relativePath: "src/b.ts", stageCode: "UU" },
    ],
    branchInfo: { currentBranch: "master", mergeHead: "feature" },
    activeDocument: null,
    activeBlockId: null,
    loading: false,
    error: null,
  });
});

afterEach(() => cleanup());

describe("App host messages", () => {
  it("removes a resolved file from the conflict list immediately", async () => {
    render(<App />);

    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.getByText("src/b.ts")).toBeTruthy();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r1",
          type: "merge.resolved",
          ok: true,
          payload: { path: "src/a.ts" },
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("src/a.ts")).toBeNull();
    });
    expect(screen.getByText("src/b.ts")).toBeTruthy();
  });

  it("merge.saved closes resolver but keeps file in conflict list when auto-stage is off", async () => {
    useGitViewStore.setState({
      screen: "mergeResolver",
      activeDocument: makeResolverDoc(),
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "UU" },
      ],
    });
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r2",
          type: "merge.saved",
          ok: true,
          payload: {
            path: "src/a.ts",
            hint: "Saved. Stage the file in Git to mark it resolved.",
          },
        },
      }),
    );

    await waitFor(() => {
      const state = useGitViewStore.getState();
      expect(state.screen).toBe("conflictList");
      expect(state.activeDocument).toBeNull();
      expect(
        state.conflictFiles.some((f) => f.relativePath === "src/a.ts"),
      ).toBe(true);
      expect(state.statusMessage).toContain("Stage the file");
    });
    expect(screen.queryByTestId("pane-left")).toBeNull();
  });

  it("merge.resolved closes resolver and removes file from conflict list", async () => {
    // GitView behavior this protects: Apply finishes resolution and returns to list.
    useGitViewStore.setState({
      screen: "mergeResolver",
      activeDocument: makeResolverDoc(),
      conflictFiles: [
        { relativePath: "src/a.ts", stageCode: "UU" },
        { relativePath: "src/b.ts", stageCode: "UU" },
      ],
    });
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r3",
          type: "merge.resolved",
          ok: true,
          payload: { path: "src/a.ts" },
        },
      }),
    );

    await waitFor(() => {
      const state = useGitViewStore.getState();
      expect(state.screen).toBe("conflictList");
      expect(state.activeDocument).toBeNull();
      expect(
        state.conflictFiles.some((f) => f.relativePath === "src/a.ts"),
      ).toBe(false);
      expect(
        state.conflictFiles.some((f) => f.relativePath === "src/b.ts"),
      ).toBe(true);
    });
  });

  it("routes app:error to the store toast", async () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r4",
          type: "error",
          ok: false,
          error: { code: "SAVE_FAILED", message: "Disk full" },
        },
      }),
    );

    await waitFor(() => {
      expect(useGitViewStore.getState().toasts.at(-1)?.message).toBe("Disk full");
    });
  });

  it("clears stale errors when the conflict list refreshes", async () => {
    useGitViewStore.setState({
      error: "That file is not in the current unmerged conflict list.",
    });
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          type: "conflict.snapshot",
          payload: {
            repoRoot: "/r",
            files: [{ relativePath: "src/a.ts", stageCode: "UU" }],
            branchInfo: { currentBranch: "main" },
          },
        },
      }),
    );

    await waitFor(() => {
      expect(useGitViewStore.getState().error).toBeNull();
    });
  });

  it("routes git:blameResult into the blame store", async () => {
    useBlameStore.getState().setLoading("ours", "src/a.ts");
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          type: "blame.snapshot",
          payload: {
            repoId: "test-repo",
            filePath: "src/a.ts",
            ref: "HEAD",
            refreshedAt: Date.now(),
            lines: [
              {
                lineNumber: 1,
                sha: "abc1234567890abcdef1234567890abcdef12345",
                shortSha: "abc1234",
                author: "Jane",
                authorEmail: "jane@example.com",
                authorTime: 1,
                summary: "Init",
              },
            ],
          },
        },
      }),
    );

    await waitFor(() => {
      expect(useBlameStore.getState().ours.lines).toHaveLength(1);
    });
  });

  it("routes git:annotateRequest to enter merge resolver", async () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          type: "blame.annotateRequest",
          payload: { relativePath: "src/b.ts", side: "theirs" },
        },
      }),
    );

    await waitFor(() => {
      const state = useGitViewStore.getState();
      expect(state.screen).toBe("mergeResolver");
      expect(state.annotateOnOpen).toBe("theirs");
    });
  });

  it("applies app:settings payload to the store", async () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          type: "merge.settings",
          payload: {
            mergeEngine: "threeWay",
            conflictPlaceholder: "base",
            acceptBothOrder: "oursFirst",
            autoStageOnResolved: true,
            showBasePanel: true,
            confirmBeforeMarkResolved: false,
            enableScrollSync: false,
            showWordLevelDiff: true,
            autoResolveBothSame: true,
            whitespacePolicy: "ignoreWhitespaces",
            highlightingMode: "words",
            warnOnCrlf: false,
            goToNextFileAfterLastChange: false,
            foldUnchangedRegions: true,
            foldThreshold: 5,
          },
        },
      }),
    );

    await waitFor(() => {
      const state = useGitViewStore.getState();
      expect(state.showBase).toBe(true);
      expect(state.confirmBeforeMarkResolved).toBe(false);
      expect(state.whitespacePolicy).toBe("ignoreWhitespaces");
    });
  });
});
