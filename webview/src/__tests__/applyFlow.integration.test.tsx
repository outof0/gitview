// @vitest-environment jsdom
/**
 * Webview ↔ host Apply round-trip: catches regressions where unit tests pass
 * but the resolver never closes or never posts markResolved.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeMonaco } from "../test/fakeMonaco";

const fakeMonaco = createFakeMonaco();

vi.mock("../components/merge/monacoSetup", () => ({
  loadMonaco: vi.fn(() => Promise.resolve(fakeMonaco)),
  getMonacoIfLoaded: vi.fn(() => fakeMonaco),
}));

import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { App } from "../App";
import { useGitViewStore } from "../stores/gitViewStore";
import {
  findMergeTestMessage,
  installMergeTestClient,
  mergeTestOutbound,
} from "../hooks/merge/mergeClientContext";
import { buildMergeDocument } from "../../../src/core/mergeDocument";
import { __resetVsCodeApiForTests } from "../hooks/useVsCodeApi";

vi.stubGlobal("acquireVsCodeApi", () => ({
  postMessage: (msg: unknown) =>
    mergeTestOutbound.push(
      msg as {
        type: string;
        payload?: unknown;
        protocolVersion?: number;
        requestId?: string;
      },
    ),
  getState: () => null,
  setState: () => {},
}));

function loadConflictDoc() {
  const doc = buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/app.ts",
    absolutePath: "/repo/src/app.ts",
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
  });
  useGitViewStore.setState({
    screen: "mergeResolver",
    activeDocument: doc,
    activeBlockId: null,
    conflictFiles: [{ relativePath: "src/app.ts", stageCode: "UU" }],
    confirmBeforeMarkResolved: false,
  });
  return doc;
}

describe("Apply flow integration", () => {
  beforeEach(() => {
    installMergeTestClient("test-repo");
    __resetVsCodeApiForTests();
    useGitViewStore.setState({
      screen: "conflictList",
      activeDocument: null,
      conflictFiles: [],
      toasts: [],
      statusMessage: null,
    });
  });

  it("Apply posts merge:markResolved with serialized content after resolving", () => {
    loadConflictDoc();
    render(<App />);

    fireEvent.click(
      within(screen.getByTestId("pane-right")).getByLabelText("accept-right"),
    );
    fireEvent.click(
      within(screen.getByTestId("pane-left")).getByLabelText("ignore"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const msg = findMergeTestMessage("merge.markResolved");
    expect(msg).toBeDefined();
    const payload = msg!.payload as { path: string; content: string };
    expect(payload.path).toBe("src/app.ts");
    expect(payload.content).toContain("theirs");
    expect(payload.content).not.toContain("<<<<<<<");
  });

  it("merge.resolved from host closes the resolver", async () => {
    loadConflictDoc();
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r1",
          type: "merge.resolved",
          ok: true,
          payload: { path: "src/app.ts" },
        },
      }),
    );

    await waitFor(() => {
      expect(useGitViewStore.getState().screen).toBe("conflictList");
      expect(useGitViewStore.getState().activeDocument).toBeNull();
    });
    expect(screen.queryByTestId("pane-left")).toBeNull();
  });

  it("discard confirmation closes the resolver after host accepts discard", async () => {
    loadConflictDoc();
    useGitViewStore.setState({
      activeDocument: {
        ...useGitViewStore.getState().activeDocument!,
        dirty: true,
      },
    });
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r2",
          type: "merge.confirmDiscard",
          ok: true,
          payload: { action: "backToList" },
        },
      }),
    );

    await waitFor(() => {
      expect(useGitViewStore.getState().screen).toBe("conflictList");
      expect(useGitViewStore.getState().activeDocument).toBeNull();
    });
  });

  it("merge.saved from host closes the resolver when auto-stage is off", async () => {
    loadConflictDoc();
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: "r3",
          type: "merge.saved",
          ok: true,
          payload: {
            path: "src/app.ts",
            hint: "Saved. Stage the file in Git to mark it resolved.",
          },
        },
      }),
    );

    await waitFor(() => {
      expect(useGitViewStore.getState().screen).toBe("conflictList");
      expect(
        useGitViewStore.getState().conflictFiles.some(
          (f) => f.relativePath === "src/app.ts",
        ),
      ).toBe(true);
    });
  });
});