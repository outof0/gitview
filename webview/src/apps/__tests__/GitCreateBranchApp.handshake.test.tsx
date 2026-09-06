// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { PROTOCOL_VERSION, responseTypeFor } from "@gitview/shared/protocol";
import { __resetVsCodeApiForTests } from "../../hooks/useVsCodeApi";
import { GitCreateBranchApp } from "../GitCreateBranchApp";

const posted: Array<{ type?: string; requestId?: string }> = [];

beforeEach(() => {
  posted.length = 0;
  __resetVsCodeApiForTests();
  (
    window as unknown as { __GITVIEW_BOOTSTRAP__?: { repoId: string } }
  ).__GITVIEW_BOOTSTRAP__ = { repoId: "test-repo" };
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) => posted.push(msg as { type?: string }),
    getState: () => null,
    setState: () => {},
  });
});

afterEach(async () => {
  // Settle every request still in flight. Each pending request owns a 30s
  // timeout; leaving them armed leaks timers across tests and keeps the worker
  // alive after the last assertion.
  await act(async () => {
    for (const msg of posted) {
      if (!msg.requestId) {
        continue;
      }
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            protocolVersion: PROTOCOL_VERSION,
            requestId: msg.requestId,
            ok: false,
            error: { message: "test teardown" },
          },
        }),
      );
    }
  });
  cleanup();
  delete window.__GITVIEW_BOOTSTRAP__;
  vi.clearAllTimers();
  vi.useRealTimers();
});

/**
 * Replies to the first request the app posted, as the host would. The response
 * type is derived from the request type so the envelope stays in step with
 * `protocolMap` — a hand-written `"ready"` here would be silently rejected as
 * `Unexpected response type "ready" for "webview.ready"`.
 */
function replyToFirstRequest(
  reply: Omit<Record<string, unknown>, "requestId" | "type"> & {
    type?: string;
  },
): void {
  const request = posted.find((msg) => Boolean(msg.requestId));
  expect(request).toBeTruthy();
  const type = reply.type ?? responseTypeFor(String(request?.type));
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        protocolVersion: PROTOCOL_VERSION,
        requestId: request?.requestId,
        type,
        ...reply,
      },
    }),
  );
}

/**
 * The rejection settles on a promise chain, so the state update it triggers
 * lands outside React's event handlers and is flushed by the scheduler — a
 * macrotask. Two microtask ticks are not enough; `act` drains the queue.
 */
async function replyAndSettle(
  reply: Parameters<typeof replyToFirstRequest>[0],
): Promise<void> {
  await act(async () => {
    replyToFirstRequest(reply);
  });
}

describe("GitCreateBranchApp handshake", () => {
  // Regression: `client.ready()` used to end in `.catch(() => {})`. When the
  // handshake failed the dialog stayed on `ready === false` and rendered
  // nothing — no error, no close button, no way out. This pins the failure
  // surface.
  it("surfaces a rejected handshake instead of rendering nothing", async () => {
    render(<GitCreateBranchApp />);
    expect(screen.queryByTestId("create-branch-error-banner")).toBeNull();

    await replyAndSettle({
      ok: false,
      error: { message: "host exploded" },
    });

    const banner = screen.getByTestId("create-branch-error-banner");
    expect(banner.textContent).toContain("Could not start the Create Branch");
    expect(banner.textContent).toContain("host exploded");
    expect(screen.getByTestId("create-branch-error-close")).toBeTruthy();
  });

  // A rejection is not the only failure mode: a host that never answers leaves
  // the promise pending forever. The timeout is what makes that recoverable.
  it("surfaces an error when the host never answers the handshake", async () => {
    vi.useFakeTimers();
    render(<GitCreateBranchApp />);
    expect(screen.queryByTestId("create-branch-error-banner")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const banner = screen.getByTestId("create-branch-error-banner");
    expect(banner.textContent).toContain("the editor did not respond");
    expect(screen.getByTestId("create-branch-error-close")).toBeTruthy();
  });

  it("does not report an error when the handshake succeeds", async () => {
    vi.useFakeTimers();
    render(<GitCreateBranchApp />);

    await act(async () => {
      replyToFirstRequest({ ok: true, payload: {} });
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.queryByTestId("create-branch-error-banner")).toBeNull();
    // Not just "no error": the dialog must actually be usable.
    expect(screen.getByTestId("create-branch-dialog")).toBeTruthy();
    expect(screen.getByTestId("create-branch-name")).toBeTruthy();
  });
});
