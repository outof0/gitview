// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceLogPanel } from "../WorkspaceLogPanel";
import type { LogSnapshot } from "@gitview/shared/types/log";

const sha = "abc1234567890abcdef1234567890abcdef1234";

const snapshot: LogSnapshot = {
  repoId: "repo-1",
  branch: "main",
  refreshedAt: Date.now(),
  commits: [
    {
      sha,
      shortSha: "abc1234",
      author: "Jane",
      authorEmail: "j@example.com",
      authorTime: 1_700_000_000,
      subject: "Fix bug",
      changedFiles: [],
    },
  ],
};

describe("WorkspaceLogPanel rewrite actions", () => {
  afterEach(() => cleanup());

  it("invokes squash and fixup rewrite handlers", () => {
    const onRewriteCommit = vi.fn();
    render(
      <WorkspaceLogPanel
        snapshot={snapshot}
        selectedSha={sha}
        selectedFilePath={null}
        diffDocument={null}
        onSelectCommit={vi.fn()}
        onSelectFile={vi.fn()}
        onRefresh={vi.fn()}
        filters={{ range: "all", limit: 200 }}
        onFiltersChange={vi.fn()}
        onRewriteCommit={onRewriteCommit}
      />,
    );

    fireEvent.click(screen.getByTestId("log-squash-commit"));
    fireEvent.click(screen.getByTestId("log-fixup-commit"));
    expect(onRewriteCommit).toHaveBeenCalledWith(sha, "squash");
    expect(onRewriteCommit).toHaveBeenCalledWith(sha, "fixup");
  });
});