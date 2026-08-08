// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceBranchComparePanel } from "../WorkspaceBranchComparePanel";
import type { BranchCompareSnapshot } from "@gitview/shared/types/branch";

const snapshot: BranchCompareSnapshot = {
  repoId: "repo-1",
  mode: "current",
  selectedRef: "feature",
  selectedLabel: "feature",
  baseLabel: "main",
  files: [
    { path: "src/a.ts", status: "M" },
    { path: "src/b.ts", status: "A" },
  ],
  refreshedAt: Date.now(),
};

describe("WorkspaceBranchComparePanel", () => {
  afterEach(() => cleanup());

  it("renders compare files and invokes selection handlers", () => {
    const onSelectFile = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkspaceBranchComparePanel
        snapshot={snapshot}
        selectedFilePath="src/a.ts"
        diffDocument={null}
        onSelectFile={onSelectFile}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("workspace-branch-compare-panel")).toBeTruthy();
    fireEvent.click(screen.getByTestId("branch-compare-file-src/b.ts"));
    expect(onSelectFile).toHaveBeenCalledWith("src/b.ts");
    fireEvent.click(screen.getByTestId("branch-compare-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies selected file from branch when action is available", () => {
    const onApplyFile = vi.fn();
    render(
      <WorkspaceBranchComparePanel
        snapshot={snapshot}
        selectedFilePath="src/a.ts"
        diffDocument={null}
        onSelectFile={vi.fn()}
        onApplyFile={onApplyFile}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("branch-compare-apply-file"));
    expect(onApplyFile).toHaveBeenCalledWith("src/a.ts");
  });
});