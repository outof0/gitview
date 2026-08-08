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
      sha: "abc1234567890abcdef1234567890abcdef1234",
      shortSha: "abc1234",
      subject: "Sample commit",
      author: "Author",
      authorEmail: "author@example.com",
      authorTime: Date.now() / 1000,
      parentShas: [],
      changedFiles: [],
    },
  ],
};

describe("WorkspaceLogPanel extract changes", () => {
  afterEach(() => cleanup());

  it("invokes extract changes for the selected commit", () => {
    const onExtractChanges = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha={snapshot.commits[0]!.sha}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
        onExtractChanges={onExtractChanges}
      />,
    );

    fireEvent.click(screen.getByTestId("log-extract-changes"));
    expect(onExtractChanges).toHaveBeenCalledWith(snapshot.commits[0]!.sha);
  });
});