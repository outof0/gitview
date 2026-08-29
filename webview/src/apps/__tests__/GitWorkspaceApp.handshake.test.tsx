// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { GitWorkspaceApp } from "../GitWorkspaceApp";
import { __resetVsCodeApiForTests } from "../../hooks/useVsCodeApi";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

const posted: Array<{ type?: string }> = [];

function messageType(msg: unknown): string | undefined {
  if (typeof msg !== "object" || msg === null || !("type" in msg)) {
    return undefined;
  }
  return String((msg as { type?: unknown }).type);
}

beforeEach(() => {
  posted.length = 0;
  __resetVsCodeApiForTests();
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) => {
      posted.push(msg as { type?: string });
      const type = messageType(msg);
      const requestId =
        typeof msg === "object" && msg && "requestId" in msg
          ? String((msg as { requestId?: unknown }).requestId ?? "")
          : "";
      if (type === "webview.ready") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              protocolVersion: PROTOCOL_VERSION,
              type: "webview.ready",
              requestId,
              ok: true,
              payload: { surface: "gitWorkspace", settings: {} },
            },
          }),
        );
      }
    },
    getState: () => null,
    setState: () => {},
  });
});

afterEach(() => {
  cleanup();
  __resetVsCodeApiForTests();
  useGitWorkspaceStore.setState({
    loading: true,
    repoSnapshot: null,
    statusSnapshot: null,
    stashSnapshot: null,
    shelfSnapshot: null,
    reviewSnapshot: null,
    error: null,
  });
});

describe("Git Workspace host handshake", () => {
  it("does not prefetch stash, shelf, or review on the Changes tab", async () => {
    render(<GitWorkspaceApp />);

    await waitFor(() => {
      expect(posted.some((msg) => messageType(msg) === "webview.ready")).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(posted.some((msg) => messageType(msg) === "repo.refresh")).toBe(
        true,
      );
    });

    const types = posted.map(messageType);
    expect(types.filter((type) => type === "webview.ready")).toHaveLength(1);
    expect(types.filter((type) => type === "repo.refresh")).toHaveLength(1);
    expect(types).not.toContain("stash.list");
    expect(types).not.toContain("shelf.list");
    expect(types).not.toContain("review.list");
  });
});
