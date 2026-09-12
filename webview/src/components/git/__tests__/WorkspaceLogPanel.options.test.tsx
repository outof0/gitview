// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { WorkspaceLogPanel } from "../WorkspaceLogPanel";
import type { LogSnapshot } from "@gitview/shared/types/log";

const snapshot: LogSnapshot = {
  repoId: "repo-1",
  branch: "main",
  refreshedAt: Date.now(),
  commits: [
    {
      sha: "a".repeat(40),
      shortSha: "aaaaaaa",
      author: "Alice",
      authorEmail: "alice@example.com",
      authorTime: 1_700_000_000,
      subject: "Initial",
      parentShas: [],
      changedFiles: [],
    },
  ],
};

describe("WorkspaceLogPanel log options", () => {
  afterEach(() => cleanup());

  it("gives the commit list its own vertical scroll container", () => {
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("workspace-log-commits-scroll").className,
    ).toContain("overflow-y-auto");
  });

  it("shows the loading placeholder before the first snapshot instead of empty", () => {
    vi.useFakeTimers();
    try {
      render(
        <WorkspaceLogPanel
          snapshot={null}
          selectedSha={null}
          selectedFilePath={null}
          diffDocument={null}
          onSelectCommit={vi.fn()}
          onSelectFile={vi.fn()}
          onRefresh={vi.fn()}
          filters={{ range: "all", limit: 200 }}
          onFiltersChange={vi.fn()}
        />,
      );

      // Nothing at all until loading actually stalls: no "No commits" flash.
      expect(screen.queryByTestId("git-commit-list-loading")).toBeNull();
      expect(screen.queryByTestId("git-commit-list-empty")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByTestId("git-commit-list-loading")).toBeTruthy();
      expect(screen.queryByTestId("git-commit-list-empty")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads another page when the commit list is scrolled near the bottom", () => {
    const onLoadMore = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={{ ...snapshot, hasMore: true }}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={onLoadMore}
        filters={{ range: "all", limit: 1 }}
        onFiltersChange={vi.fn()}
      />,
    );

    const scroll = screen.getByTestId("workspace-log-commits-scroll");
    Object.defineProperties(scroll, {
      scrollHeight: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 300 },
    });
    fireEvent.scroll(scroll);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("prefetches while there is still about two screens left to scroll", () => {
    const onLoadMore = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={{ ...snapshot, hasMore: true }}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={onLoadMore}
        filters={{ range: "all", limit: 1 }}
        onFiltersChange={vi.fn()}
      />,
    );

    const scroll = screen.getByTestId("workspace-log-commits-scroll");
    Object.defineProperties(scroll, {
      scrollHeight: { configurable: true, value: 10_000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 8_900 },
    });
    fireEvent.scroll(scroll);

    // 700px are still below the viewport, inside the two-screen prefetch zone.
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not prefetch while the buffered pages are still far ahead", () => {
    const onLoadMore = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={{ ...snapshot, hasMore: true }}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={onLoadMore}
        filters={{ range: "all", limit: 1 }}
        onFiltersChange={vi.fn()}
      />,
    );

    const scroll = screen.getByTestId("workspace-log-commits-scroll");
    Object.defineProperties(scroll, {
      scrollHeight: { configurable: true, value: 10_000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 5_000 },
    });
    fireEvent.scroll(scroll);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("keeps prefetching after an append while the buffer is still short", () => {
    const onLoadMore = vi.fn();
    const view = render(
      <WorkspaceLogPanel
        snapshot={{ ...snapshot, hasMore: true }}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={onLoadMore}
        filters={{ range: "all", limit: 1 }}
        onFiltersChange={vi.fn()}
      />,
    );

    const scroll = screen.getByTestId("workspace-log-commits-scroll");
    Object.defineProperties(scroll, {
      scrollHeight: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 400 },
    });
    fireEvent.scroll(scroll);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    view.rerender(
      <WorkspaceLogPanel
        snapshot={{
          ...snapshot,
          hasMore: true,
          commits: [
            ...snapshot.commits,
            {
              ...snapshot.commits[0]!,
              sha: "b".repeat(40),
              shortSha: "bbbbbbb",
              subject: "Second",
            },
          ],
        }}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        onLoadMore={onLoadMore}
        filters={{ range: "all", limit: 1 }}
        onFiltersChange={vi.fn()}
      />,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("keeps the graph gutter width stable while loading older pages", () => {
    const merge = {
      ...snapshot.commits[0]!,
      sha: "merge",
      shortSha: "merge",
      parentShas: ["main", "feature"],
      isMerge: true,
    };
    const main = {
      ...snapshot.commits[0]!,
      sha: "main",
      shortSha: "main",
      parentShas: [],
    };
    const feature = {
      ...snapshot.commits[0]!,
      sha: "feature",
      shortSha: "feature",
      parentShas: [],
    };
    const props = {
      snapshot: { ...snapshot, commits: [merge, main] },
      selectedSha: null,
      selectedFilePath: null,
      diffDocument: null,
      onSelectCommit: vi.fn(),
      onSelectFile: vi.fn(),
      onRefresh: vi.fn(),
      filters: { range: "all" as const, limit: 200 },
      onFiltersChange: vi.fn(),
    };
    const { rerender } = render(<WorkspaceLogPanel {...props} />);
    const graph = screen.getByTestId("git-log-graph");
    const initialWidth = graph.getAttribute("width");
    expect(initialWidth).toBeTruthy();

    rerender(
      <WorkspaceLogPanel
        {...props}
        snapshot={{ ...snapshot, commits: [merge, main, feature] }}
      />,
    );

    expect(screen.getByTestId("git-log-graph").getAttribute("width")).toBe(
      initialWidth,
    );
  });

  it("toggles hide merge commits and first parent filters", () => {
    const onFiltersChange = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha={null}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(screen.getByTestId("log-view-options"));
    fireEvent.click(screen.getByTestId("log-option-no-merges"));
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ noMerges: true }),
    );

    fireEvent.click(screen.getByTestId("log-option-first-parent"));
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ firstParent: true }),
    );
  });

  it("copies commit hash when action is provided", () => {
    const onCopyHash = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha={"a".repeat(40)}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
        onCopyHash={onCopyHash}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("git-commit-aaaaaaa"));
    fireEvent.click(screen.getByTestId("log-copy-hash"));
    expect(onCopyHash).toHaveBeenCalledWith("a".repeat(40));
  });
});
