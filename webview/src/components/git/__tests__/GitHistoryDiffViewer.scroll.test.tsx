// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { FileDiffView } from "@gitview/types";
import { createFakeMonaco } from "../../../test/fakeMonaco";
import { GitHistoryDiffViewer } from "../GitHistoryDiffViewer";

const fakeMonaco = createFakeMonaco();

vi.mock("../../merge/monacoSetup", () => ({
  loadMonaco: vi.fn(() => Promise.resolve(fakeMonaco)),
  getMonacoIfLoaded: vi.fn(() => fakeMonaco),
}));

const diff: FileDiffView = {
  layout: "split",
  status: "M",
  binary: false,
  left: {
    label: "HEAD",
    text: Array.from({ length: 60 }, (_, i) => `old line ${i + 1}`).join("\n"),
  },
  right: {
    label: "Working tree",
    text: Array.from({ length: 60 }, (_, i) => `new line ${i + 1}`).join("\n"),
  },
};

describe("GitHistoryDiffViewer Monaco split", () => {
  beforeEach(() => {
    cleanup();
  });
  afterEach(() => cleanup());

  it("mounts a Monaco DiffEditor for side-by-side compare", async () => {
    render(
      <GitHistoryDiffViewer
        diff={diff}
        filePath="src/app.ts"
        variant="standalone"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("git-diff-split").getAttribute("data-monaco-ready")).toBe(
        "true",
      );
    });
    const host = screen.getByTestId("monaco-diff-host");
    expect(host.getAttribute("data-fake-monaco-diff")).toBe("true");
    // Both sides render source (native Monaco handles scroll-sync)
    expect(screen.getByTestId("git-diff-left-scroll").textContent).toContain(
      "old line 1",
    );
    expect(screen.getByTestId("git-diff-right-scroll").textContent).toContain(
      "new line 1",
    );
  });
});
