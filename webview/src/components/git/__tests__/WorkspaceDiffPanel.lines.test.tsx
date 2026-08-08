// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceDiffPanel } from "../WorkspaceDiffPanel";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";

const document: WorkspaceDiffDocument = {
  repoId: "repo-1",
  filePath: "sample.txt",
  layout: "split",
  status: "M",
  staged: false,
  binary: false,
  left: {
    label: "HEAD",
    text: "line1\nline2\nline3\nline4\nline5\n",
  },
  right: {
    label: "Working tree",
    text: "line1\nline2-changed\nline3\nline4-changed\nline5\n",
  },
};

describe("WorkspaceDiffPanel line actions", () => {
  afterEach(() => cleanup());

  it("shows line action bar after selecting a changed line", () => {
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="sample.txt"
        showHunkActions
        onStageLines={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("diff-line-right-2"));
    expect(screen.getByTestId("line-actions-bar")).toBeTruthy();
    expect(screen.getByTestId("stage-lines")).toBeTruthy();
  });

  it("calls onStageLines with the selected line", () => {
    const onStageLines = vi.fn();
    render(
      <WorkspaceDiffPanel
        document={document}
        filePath="sample.txt"
        showHunkActions
        onStageLines={onStageLines}
      />,
    );

    fireEvent.click(screen.getByTestId("diff-line-right-4"));
    fireEvent.click(screen.getByTestId("stage-lines"));
    expect(onStageLines).toHaveBeenCalledWith([{ side: "new", line: 4 }]);
  });
});