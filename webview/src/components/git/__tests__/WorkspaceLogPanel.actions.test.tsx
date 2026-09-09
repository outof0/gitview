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
      refs: ["feature/remove-me"],
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
    expect(
      screen.getByTestId("workspace-log-details-pane").textContent,
    ).not.toContain("feature/remove-me");
    fireEvent.contextMenu(screen.getByTestId("git-commit-abc1234"));
    fireEvent.click(screen.getByTestId("log-cherry-pick"));
    fireEvent.contextMenu(screen.getByTestId("git-commit-abc1234"));
    fireEvent.click(screen.getByTestId("log-revert"));
    expect(onCherryPick).toHaveBeenCalledWith(
      "abc1234567890abcdef1234567890abcdef1234",
    );
    expect(onRevert).toHaveBeenCalledWith(
      "abc1234567890abcdef1234567890abcdef1234",
    );
  });

  it("activates a changed file on double-click", () => {
    const onOpenFileDiff = vi.fn();
    const onSelectFile = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha="abc1234567890abcdef1234567890abcdef1234"
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={onSelectFile}
        onOpenFileDiff={onOpenFileDiff}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId("changed-files-file-src/app.ts"));
    expect(onSelectFile).toHaveBeenCalledWith("src/app.ts", "M");
    expect(onOpenFileDiff).toHaveBeenCalledWith("src/app.ts", "M");
  });

  it("keeps the root log free of an inline diff footer", () => {
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha="abc1234567890abcdef1234567890abcdef1234"
        selectedFilePath="src/app.ts"
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onOpenFileDiff={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("workspace-log-files-pane")).toBeTruthy();
    expect(screen.queryByTestId("workspace-log-toggle-diff")).toBeNull();
    expect(screen.queryByTestId("workspace-log-diff-pane")).toBeNull();
  });
});
