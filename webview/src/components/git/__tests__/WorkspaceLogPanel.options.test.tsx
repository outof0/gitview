// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    fireEvent.click(screen.getByTestId("log-copy-hash"));
    expect(onCopyHash).toHaveBeenCalledWith("a".repeat(40));
  });
});