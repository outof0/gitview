// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import type { CollapsedLogCommit } from "../../../lib/collapseLinearCommits";
import { GitCommitList } from "../GitCommitList";

afterEach(cleanup);

function commit(sha: string, parentShas: string[] = []): LogCommitEntry {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject: `Subject ${sha}`,
    author: "Jane",
    authorEmail: "jane@example.com",
    authorTime: 0,
    parentShas,
    isMerge: parentShas.length > 1,
    changedFiles: [],
  };
}

const base = [
  commit("aaa", ["bbb"]),
  commit("bbb", ["ccc"]),
  commit("ccc"),
];

function wrap(
  props: {
    commits?: LogCommitEntry[];
    entries?: CollapsedLogCommit[];
    selectedSha?: string | null;
    loading?: boolean;
  },
) {
  return (
    <div
      data-testid="scroll"
      style={{ overflowY: "auto", height: 400 }}
    >
      <GitCommitList
        commits={props.commits}
        entries={props.entries}
        selectedSha={props.selectedSha ?? null}
        onSelect={() => {}}
        graphDensity
        loading={props.loading}
      />
    </div>
  );
}

function stubContext(): {
  context: CanvasRenderingContext2D;
  arc: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
} {
  const arc = vi.fn();
  const clearRect = vi.fn();
  const context = {
    setTransform: vi.fn(),
    clearRect,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc,
    fill: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  return { context, arc, clearRect };
}

describe("GitCommitList graph viewport", () => {
  it("does not scroll back to the selected commit when pages append", () => {
    const view = render(wrap({ commits: base, selectedSha: "aaa" }));
    const scroller = screen.getByTestId("scroll");
    scroller.scrollTop = 240;

    view.rerender(
      wrap({
        commits: [...base, commit("ddd", ["eee"]), commit("eee")],
        selectedSha: "aaa",
      }),
    );

    expect(scroller.scrollTop).toBe(240);
  });

  it("scrolls to a newly selected commit", () => {
    const view = render(wrap({ commits: base, selectedSha: null }));
    const scroller = screen.getByTestId("scroll");
    scroller.scrollTop = 0;

    view.rerender(wrap({ commits: base, selectedSha: "ccc" }));

    // Row 2 starts at 48; the 24px viewport leaves a 24px bottom overflow.
    expect(scroller.scrollTop).toBe(48);
  });

  it("keeps the gutter width fixed and never scales the graph", () => {
    const view = render(wrap({ commits: base }));
    const initialGraph = screen.getByTestId("git-log-graph");
    expect(initialGraph.getAttribute("width")).toBe("72");
    expect((initialGraph as HTMLElement).style.transform).toBe("");

    view.rerender(
      wrap({
        commits: [
          commit("aaa", ["bbb", "ccc"]),
          commit("bbb"),
          commit("ccc"),
          commit("ddd", ["eee"]),
          commit("eee"),
        ],
      }),
    );

    const grownGraph = screen.getByTestId("git-log-graph");
    expect(grownGraph.getAttribute("width")).toBe("72");
    expect((grownGraph as HTMLElement).style.transform).toBe("");
    const row = document.querySelector('[data-graph-row="true"]') as
      | HTMLElement
      | null;
    expect(row?.style.gridTemplateColumns.startsWith("72px")).toBe(true);
  });

  it("goes straight to the list when the first page arrives quickly", () => {
    vi.useFakeTimers();
    try {
      const view = render(wrap({ commits: [], loading: true }));

      expect(screen.queryByTestId("git-commit-list-loading")).toBeNull();
      expect(screen.queryByTestId("git-commit-list-empty")).toBeNull();

      view.rerender(wrap({ commits: base, loading: false }));
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByTestId("git-commit-aaa")).toBeTruthy();
      expect(screen.queryByTestId("git-commit-list-loading")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps rendered rows while a refresh is loading", () => {
    const view = render(wrap({ commits: base, loading: true }));

    expect(screen.getByTestId("git-commit-aaa")).toBeTruthy();
    expect(screen.queryByTestId("git-commit-list-loading")).toBeNull();

    view.rerender(wrap({ commits: base, loading: false }));

    expect(screen.getByTestId("git-commit-aaa")).toBeTruthy();
  });

  it("attaches scroll handling after a loading render", () => {
    const many = Array.from({ length: 200 }, (_, index) =>
      commit(`s-${String(index).padStart(4, "0")}`),
    );
    const view = render(wrap({ commits: many, loading: true }));
    view.rerender(wrap({ commits: many, loading: false }));

    const scroller = screen.getByTestId("scroll");
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 400,
    });
    scroller.scrollTop = 150 * 24;
    fireEvent.scroll(scroller);

    expect(screen.queryByTestId("git-commit-s-0000")).toBeNull();
    expect(screen.getByTestId("git-commit-s-0150")).toBeTruthy();
  });

  it("rebuilds lanes when the middle of the list is reordered", () => {
    const view = render(
      wrap({
        commits: [
          commit("tip", ["main"]),
          commit("main", ["base"]),
          commit("base"),
        ],
      }),
    );

    view.rerender(
      wrap({
        commits: [
          commit("tip", ["main", "feature"]),
          commit("feature", ["base"]),
          commit("main", ["base"]),
          commit("base"),
        ],
      }),
    );

    const featureRow = screen.getByTestId("git-commit-feature");
    const tipRow = screen.getByTestId("git-commit-tip");
    expect(featureRow.getAttribute("data-graph-lane")).toBe("1");
    expect(tipRow.getAttribute("data-graph-lane")).toBe("0");
  });

  it("grows the rendered row window when the panel is resized", () => {
    const many = Array.from({ length: 200 }, (_, index) =>
      commit(`r-${String(index).padStart(4, "0")}`),
    );
    render(wrap({ commits: many }));

    const scroller = screen.getByTestId("scroll");
    let clientHeight = 200;
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => clientHeight,
    });
    scroller.scrollTop = 0;
    fireEvent.scroll(scroller);
    expect(screen.queryByTestId("git-commit-r-0080")).toBeNull();

    clientHeight = 1200;
    fireEvent(window, new Event("resize"));

    expect(screen.getByTestId("git-commit-r-0080")).toBeTruthy();
  });

  it("repaints the canvas when theme attributes change", async () => {
    const { context, clearRect } = stubContext();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context);
    try {
      render(wrap({ commits: base }));
      const before = clearRect.mock.calls.length;

      document.documentElement.setAttribute(
        "data-vscode-theme-kind",
        "vscode-light",
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(clearRect.mock.calls.length).toBeGreaterThan(before);
    } finally {
      document.documentElement.removeAttribute("data-vscode-theme-kind");
      getContext.mockRestore();
    }
  });

  it("paints the full row range when collapsed placeholders add rows", () => {
    const { context, arc } = stubContext();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context);
    try {
      const entries: CollapsedLogCommit[] = [
        { kind: "commit", commit: commit("aaa") },
        {
          kind: "collapsed",
          commits: [commit("bbb"), commit("ccc"), commit("ddd")],
          fromSha: "bbb",
          toSha: "ddd",
          count: 3,
        },
        { kind: "commit", commit: commit("eee") },
        { kind: "commit", commit: commit("fff") },
      ];
      render(wrap({ entries }));

      const canvas = screen.getByTestId("git-log-graph-canvas");
      expect(canvas.style.height).toBe(`${4 * 24}px`);
      expect(arc).toHaveBeenCalled();
    } finally {
      getContext.mockRestore();
    }
  });
});
