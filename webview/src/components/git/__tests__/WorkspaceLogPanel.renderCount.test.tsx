// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogQueryFilters, LogSnapshot } from "@gitview/shared/types/log";
import { WorkspaceLogPanel } from "../WorkspaceLogPanel";
import type { WorkspaceLogPanelProps } from "../workspaceLogPanel/workspaceLogPanelTypes";

/**
 * Regression guard for the re-render storm.
 *
 * `GitCommitRow` is memoized on purpose (see its docblock): the log can hold
 * thousands of commits, so selecting one must not re-render every row. That
 * memo only holds while the callbacks reaching the row keep a stable identity —
 * a single inline arrow in WorkspaceLogPanel turns it into dead code.
 *
 * The bug is invisible in the DOM (output is identical, only the work differs),
 * so this counts renders instead of asserting markup.
 */

const rowSpy = vi.hoisted(() => ({
  renders: 0,
  lastProps: null as unknown,
}));

// Wrap the REAL row instead of replacing it: the component under test *is* the
// `memo`, so a plain stub would remove the very thing being measured. The
// wrapper carries the same memo semantics as the row it wraps.
vi.mock("../GitCommitRow", async (importOriginal) => {
  const { createElement, memo } = await import("react");
  const actual = await importOriginal<typeof import("../GitCommitRow")>();
  return {
    GitCommitRow: memo(function RowRenderCounter(
      props: Parameters<typeof actual.GitCommitRow>[0],
    ) {
      rowSpy.renders += 1;
      rowSpy.lastProps = props;
      return createElement(actual.GitCommitRow, props);
    }),
  };
});

const COMMIT_COUNT = 50;

function makeSnapshot(): LogSnapshot {
  return {
    repoId: "repo-1",
    branch: "main",
    refreshedAt: 0,
    commits: Array.from({ length: COMMIT_COUNT }, (_, index) => ({
      sha: `sha-${index}`,
      shortSha: `sha-${index}`.slice(0, 7),
      author: "Jane",
      authorEmail: "jane@example.com",
      authorTime: 1_700_000_000 + index,
      subject: `Commit ${index}`,
      changedFiles: [{ path: `src/file-${index}.ts`, status: "M" as const }],
    })),
  };
}

const filters: LogQueryFilters = { range: "all", limit: 200 };

/**
 * Every reference here is created once and reused, which is what the log tab
 * must achieve for a re-render to stay cheap. If this passes but the app still
 * storms, the leak is upstream in GitWorkspaceLogTab, not in this panel.
 */
function stableProps(
  overrides: Partial<WorkspaceLogPanelProps> = {},
): WorkspaceLogPanelProps {
  return {
    snapshot: makeSnapshot(),
    selectedSha: "sha-0",
    selectedShas: [],
    selectedFilePath: "src/file-0.ts",
    diffDocument: null,
    filters,
    onSelectCommit: () => {},
    onSelectFile: () => {},
    onRefresh: () => {},
    onFiltersChange: () => {},
    ...overrides,
  };
}

describe("WorkspaceLogPanel render cost", () => {
  beforeEach(() => {
    rowSpy.renders = 0;
    rowSpy.lastProps = null;
  });

  it("does not re-render commit rows when an unrelated prop changes", () => {
    const props = stableProps();
    const { rerender } = render(<WorkspaceLogPanel {...props} />);

    const afterFirstRender = rowSpy.renders;
    expect(afterFirstRender).toBe(COMMIT_COUNT);
    const firstProps = rowSpy.lastProps;

    rerender(<WorkspaceLogPanel {...props} busy />);

    expect(rowSpy.renders).toBe(afterFirstRender);
    expect(rowSpy.lastProps).toBe(firstProps);
  });

  it("re-renders only the rows whose selection changed", () => {
    const props = stableProps();
    const { rerender } = render(<WorkspaceLogPanel {...props} />);
    expect(rowSpy.renders).toBe(COMMIT_COUNT);

    rerender(
      <WorkspaceLogPanel {...props} selectedSha="sha-1" selectedShas={["sha-1"]} />,
    );

    // Two rows change: the one losing selection and the one gaining it.
    expect(rowSpy.renders).toBe(COMMIT_COUNT + 2);
  });
});
