// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CompareSplitView } from "../CompareSplitView";
import type { BlameLineEntry } from "@gitview/shared/types/blame";

afterEach(() => cleanup());

const LEFT = { label: "HEAD", text: "alpha\nbeta\n" };
const RIGHT = { label: "Working Tree", text: "alpha\nBETA\n" };

const blame: BlameLineEntry[] = [
  {
    lineNumber: 1,
    sha: "abc1234",
    shortSha: "abc1234",
    author: "Ada",
    authorEmail: "ada@example.com",
    authorTime: 1_700_000_000,
    summary: "first",
  },
  {
    lineNumber: 2,
    sha: "def5678",
    shortSha: "def5678",
    author: "Bob",
    authorEmail: "bob@example.com",
    authorTime: 1_700_000_100,
    summary: "second",
  },
];

function cellOrder(container: HTMLElement, side: "left" | "right"): string[] {
  const row = container.querySelector(`[data-side="${side}"]`);
  if (!row) {
    throw new Error(`no ${side} row`);
  }
  return Array.from(row.children).map((child) => {
    const cls = child.className;
    if (cls.includes("nx-blame")) {
      return "blame";
    }
    if (cls.includes("nx-diff-ln")) {
      return "line";
    }
    return "text";
  });
}

describe("CompareSplitView annotate columns", () => {
  it("mirrors the line gutters even before annotate is on", () => {
    const { container } = render(<CompareSplitView left={LEFT} right={RIGHT} />);

    expect(cellOrder(container, "left")).toEqual(["text", "line"]);
    expect(cellOrder(container, "right")).toEqual(["line", "text"]);
  });

  it("mirrors the annotated panes around the centre", () => {
    const { container } = render(
      <CompareSplitView
        left={LEFT}
        right={RIGHT}
        annotateLeft
        annotateRight
        leftBlame={blame}
        rightBlame={blame}
      />,
    );

    expect(cellOrder(container, "left")).toEqual(["text", "line", "blame"]);
    expect(cellOrder(container, "right")).toEqual(["blame", "line", "text"]);
  });

  it("toggles each side independently", () => {
    const { container } = render(
      <CompareSplitView
        left={LEFT}
        right={RIGHT}
        annotateRight
        rightBlame={blame}
      />,
    );

    expect(cellOrder(container, "left")).toEqual(["text", "line"]);
    expect(cellOrder(container, "right")).toEqual(["blame", "line", "text"]);

    const split = screen.getByTestId("git-diff-split");
    expect(split.getAttribute("data-annotate-left")).toBe("false");
    expect(split.getAttribute("data-annotate-right")).toBe("true");
  });

  it("shows the log pane below only while annotate is on", () => {
    const panel = <div data-testid="log-pane" />;
    const { rerender } = render(
      <CompareSplitView left={LEFT} right={RIGHT} bottomPanel={panel} />,
    );
    expect(screen.queryByTestId("compare-annotate-bottom-panel")).toBeNull();

    rerender(
      <CompareSplitView
        left={LEFT}
        right={RIGHT}
        annotateLeft
        leftBlame={blame}
        bottomPanel={panel}
      />,
    );
    expect(screen.getByTestId("compare-annotate-bottom-panel")).toBeTruthy();
    expect(screen.getByTestId("log-pane")).toBeTruthy();
  });
});
