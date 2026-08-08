// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
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
      author: "Jane",
      authorEmail: "j@example.com",
      authorTime: 1_700_000_000,
      subject: "Fix bug",
      changedFiles: [{ path: "src/app.ts", status: "M" }],
    },
  ],
};

describe("WorkspaceLogPanel actions", () => {
  afterEach(() => cleanup());

  it("shows cherry-pick and revert when a commit is selected", () => {
    const onCherryPick = vi.fn();
    const onRevert = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha="abc1234567890abcdef1234567890abcdef1234"
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
        onCherryPick={onCherryPick}
        onRevert={onRevert}
      />,
    );
    fireEvent.click(screen.getByTestId("log-cherry-pick"));
    fireEvent.click(screen.getByTestId("log-revert"));
    expect(onCherryPick).toHaveBeenCalledWith(
      "abc1234567890abcdef1234567890abcdef1234",
    );
    expect(onRevert).toHaveBeenCalledWith(
      "abc1234567890abcdef1234567890abcdef1234",
    );
  });
});