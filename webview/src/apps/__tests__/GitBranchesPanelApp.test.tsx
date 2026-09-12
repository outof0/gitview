// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { GitBranchesPanelApp } from "../GitBranchesPanelApp";

const posted: unknown[] = [];

beforeEach(() => {
  posted.length = 0;
  (
    window as unknown as { __GITVIEW_BOOTSTRAP__?: { repoId: string } }
  ).__GITVIEW_BOOTSTRAP__ = { repoId: "test-repo" };
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) => posted.push(msg),
    getState: () => null,
    setState: () => {},
  });
});

afterEach(() => {
  vi.clearAllTimers();
  cleanup();
  delete window.__GITVIEW_BOOTSTRAP__;
  vi.useRealTimers();
});

describe("GitBranchesPanelApp", () => {
  it("posts branch.list on mount with a repoId from bootstrap", () => {
    render(<GitBranchesPanelApp />);
    expect(
      posted.some(
        (msg) =>
          (msg as { type?: string }).type === "branch.list" &&
          (msg as { payload?: { repoId?: string } }).payload?.repoId ===
            "test-repo",
      ),
    ).toBe(true);
  });

  it("shows the loading state immediately while waiting for a response", () => {
    render(<GitBranchesPanelApp />);
    expect(screen.getByText("Loading branches…")).toBeTruthy();
  });

  // Regression: the popup used to sit at "Loading branches…" forever when the
  // host crashed, the response shape didn't match, or the webview was disposed
  // mid-flight. The protocol client's own 60 s per-request timeout does not
  // cover those cases. This test pins the user-visible backstop.
  it("clears loading and surfaces an error after BRANCHES_LOAD_TIMEOUT_MS if no response arrives", async () => {
    vi.useFakeTimers();
    render(<GitBranchesPanelApp />);
    expect(screen.getByText("Loading branches…")).toBeTruthy();
    // Advance past both the safety budget (12 s) and the protocol client's
    // own per-request timeout (60 s) so all pending timers settle and the
    // test framework does not wait on an orphaned fake timer.
    await vi.advanceTimersByTimeAsync(70_000);
    expect(screen.queryByText("Loading branches…")).toBeNull();
    expect(screen.getByText(/Branches list did not load/)).toBeTruthy();
  });

  it("clears loading when a branch.list response arrives, before the safety timer fires", async () => {
    render(<GitBranchesPanelApp />);
    expect(screen.getByText("Loading branches…")).toBeTruthy();
    const request = posted.find(
      (m) => (m as { type?: string }).type === "branch.list",
    ) as { requestId?: string } | undefined;
    expect(request?.requestId).toBeTruthy();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          requestId: request?.requestId,
          type: "branch.list",
          ok: true,
          payload: { repoId: "test-repo", branches: [], refreshedAt: 0 },
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading branches…")).toBeNull(),
    );
    expect(screen.queryByText(/Branches list did not load/)).toBeNull();
  });
});
