// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { createFakeMonaco } from "../../test/fakeMonaco";
import { GitDiffApp } from "../GitDiffApp";

const fakeMonaco = createFakeMonaco();

vi.mock("../../components/merge/monacoSetup", () => ({
  loadMonaco: vi.fn(() => Promise.resolve(fakeMonaco)),
  getMonacoIfLoaded: vi.fn(() => fakeMonaco),
}));

const LEFT = ["alpha", "beta", "gamma", "delta"].join("\n");
const RIGHT = ["alpha", "BETA", "gamma", "DELTA"].join("\n");

function sendPreview() {
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
            left: { label: "HEAD", text: LEFT },
            right: { label: "Working Tree", text: RIGHT },
          },
        },
      },
    }),
  );
}

function diffOptions(): Record<string, unknown> {
  const host = screen.getByTestId("monaco-diff-host");
  return JSON.parse(host.getAttribute("data-fake-diff-options") ?? "{}");
}

beforeEach(() => {
  delete window.__GITVIEW_BOOTSTRAP__;
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: () => {},
    getState: () => null,
    setState: () => {},
  });
});

afterEach(() => cleanup());

describe("GitDiffApp diff viewer toolbar", () => {
  it("shows the toolbar with the difference count Monaco computed", async () => {
    render(<GitDiffApp />);
    sendPreview();

    await waitFor(() => {
      expect(screen.getByTestId("git-diff-toolbar")).toBeTruthy();
      expect(
        screen.getByTestId("git-diff-difference-counter").textContent,
      ).toBe("2 differences");
    });
  });

  it("drives the Monaco viewer mode from the toolbar", async () => {
    render(<GitDiffApp />);
    sendPreview();
    await screen.findByTestId("git-diff-viewer-mode");

    expect(diffOptions().renderSideBySide).toBe(true);

    fireEvent.click(screen.getByTestId("git-diff-viewer-mode"));
    fireEvent.click(screen.getByTestId("git-diff-viewer-mode-unified"));

    await waitFor(() => {
      expect(diffOptions().renderSideBySide).toBe(false);
    });
  });

  it("drives whitespace, collapse and soft wrap options", async () => {
    render(<GitDiffApp />);
    sendPreview();
    await screen.findByTestId("git-diff-whitespace");

    fireEvent.click(screen.getByTestId("git-diff-whitespace"));
    fireEvent.click(screen.getByTestId("git-diff-whitespace-trimWhitespaces"));
    await waitFor(() => {
      expect(diffOptions().ignoreTrimWhitespace).toBe(true);
    });

    fireEvent.click(screen.getByTestId("git-diff-view-options"));
    fireEvent.click(
      screen.getByTestId("git-diff-view-options-collapseUnchanged"),
    );
    await waitFor(() => {
      expect(diffOptions().hideUnchangedRegions).toEqual({ enabled: true });
    });

    fireEvent.click(screen.getByTestId("git-diff-view-options"));
    fireEvent.click(screen.getByTestId("git-diff-view-options-softWrap"));
    await waitFor(() => {
      expect(diffOptions().diffWordWrap).toBe("on");
    });
  });

  it("mirrors the original pane's line numbers to its right edge", async () => {
    render(<GitDiffApp />);
    sendPreview();

    const strip = await screen.findByTestId("monaco-diff-left-line-numbers");
    // Monaco's own gutter is suppressed so the numbers are not drawn twice.
    const host = screen.getByTestId("monaco-diff-host");
    expect(
      JSON.parse(host.getAttribute("data-fake-original-options") ?? "{}"),
    ).toMatchObject({ lineNumbers: "off" });
    // 400px pane, 44px strip.
    expect(strip.style.left).toBe("356px");
    expect(Array.from(strip.children).map((c) => c.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("drops the mirrored gutter in the unified viewer", async () => {
    render(<GitDiffApp />);
    sendPreview();
    await screen.findByTestId("monaco-diff-left-line-numbers");

    fireEvent.click(screen.getByTestId("git-diff-viewer-mode"));
    fireEvent.click(screen.getByTestId("git-diff-viewer-mode-unified"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("monaco-diff-left-line-numbers"),
      ).toBeNull();
    });
  });

  it("jumps between differences from the toolbar and F7", async () => {
    render(<GitDiffApp />);
    sendPreview();
    await screen.findByTestId("git-diff-next-difference");

    const host = screen.getByTestId("monaco-diff-host");
    fireEvent.click(screen.getByTestId("git-diff-next-difference"));
    expect(host.getAttribute("data-fake-goto-diff")).toBe("next");

    fireEvent.click(screen.getByTestId("git-diff-prev-difference"));
    expect(host.getAttribute("data-fake-goto-diff")).toBe("previous");

    fireEvent.keyDown(window, { key: "F7" });
    expect(host.getAttribute("data-fake-goto-diff")).toBe("next");

    fireEvent.keyDown(window, { key: "F7", shiftKey: true });
    expect(host.getAttribute("data-fake-goto-diff")).toBe("previous");
  });
});
