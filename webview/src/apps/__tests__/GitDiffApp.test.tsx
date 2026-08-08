// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { GIT_DIFF_LOAD_TIMEOUT_MS, GitDiffApp } from "../GitDiffApp";

const posted: unknown[] = [];

beforeEach(() => {
  posted.length = 0;
  delete window.__GITVIEW_BOOTSTRAP__;
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: (msg: unknown) => posted.push(msg),
    getState: () => null,
    setState: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GitDiffApp v1 protocol", () => {
  it("sends webview.ready on mount", async () => {
    render(<GitDiffApp />);
    await waitFor(() => {
      expect(posted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            protocolVersion: PROTOCOL_VERSION,
            type: "webview.ready",
            payload: { surface: "gitDiff" },
          }),
        ]),
      );
    });
  });

  it("renders dense loading empty state (not centered hero)", () => {
    render(<GitDiffApp />);
    const empty = screen.getByTestId("git-diff-empty");
    expect(empty).toBeTruthy();
    expect(empty.className).toMatch(/items-start|nx-tool-empty/);
    expect(empty.className).not.toMatch(/items-center/);
    expect(screen.getByText("Loading diff…")).toBeTruthy();
    expect(screen.getByTestId("git-compare-toolbar-empty")).toBeTruthy();
  });

  it("renders error empty state from host notification", async () => {
    render(<GitDiffApp />);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          type: "notification",
          payload: {
            level: "error",
            message: "File is binary or unavailable.",
          },
        },
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("Could not load diff")).toBeTruthy();
      expect(screen.getByText("File is binary or unavailable.")).toBeTruthy();
    });
  });

  it("renders timeout empty state after load budget", async () => {
    vi.useFakeTimers();
    render(<GitDiffApp />);
    await vi.advanceTimersByTimeAsync(GIT_DIFF_LOAD_TIMEOUT_MS);
    expect(screen.getByText("Diff preview did not load")).toBeTruthy();
    expect(
      screen.getByText(/Reload the window, then run Compare or Show Diff/),
    ).toBeTruthy();
  });

  it("renders diff.preview payload from host", async () => {
    render(<GitDiffApp />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocolVersion: PROTOCOL_VERSION,
          type: "diff.preview",
          payload: {
            relativePath: "src/app.ts",
            title: "src/app.ts (HEAD ↔ Working Tree)",
            diff: {
              layout: "split",
              status: "M",
              left: { label: "HEAD", text: "old\n" },
              right: { label: "Working Tree", text: "new\n" },
            },
          },
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTitle("src/app.ts")).toBeTruthy();
      expect(screen.getByTestId("git-diff-split")).toBeTruthy();
      expect(screen.queryByTestId("git-diff-empty")).toBeNull();
    });
  });
});
