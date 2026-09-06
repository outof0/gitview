// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GitHistoryCommitMenuItems } from "../GitHistoryCommitMenuItems";
import { GitHistoryFileMenuItems } from "../GitHistoryFileMenuItems";

describe("history remote-link menu items", () => {
  afterEach(() => cleanup());

  it("commit menu dispatches remote-link actions with the commit message", () => {
    const onGitAction = vi.fn();
    const onClose = vi.fn();
    render(
      <GitHistoryCommitMenuItems
        commitSha="abc1234"
        commitMessage="subject"
        onGitAction={onGitAction}
        onClose={onClose}
      />,
    );

    for (const [testId, action] of [
      ["git-history-menu-open-on-remote", "openOnRemote"],
      ["git-history-menu-copy-remote-link", "copyRemoteLink"],
      ["git-history-menu-copy-remote-link-markdown", "copyRemoteLinkMarkdown"],
    ] as const) {
      fireEvent.click(screen.getByTestId(testId));
      expect(onGitAction).toHaveBeenLastCalledWith(action, {
        commitMessage: "subject",
      });
    }
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("file menu dispatches remote-link actions for the file at the commit", () => {
    const onGitAction = vi.fn();
    const onClose = vi.fn();
    render(
      <GitHistoryFileMenuItems
        filePath="src/app.ts"
        commitSha="abc1234"
        onGitAction={onGitAction}
        onShowDiff={vi.fn()}
        onClose={onClose}
      />,
    );

    for (const [testId, action] of [
      ["git-history-file-menu-open-on-remote", "openOnRemote"],
      ["git-history-file-menu-copy-remote-link", "copyRemoteLink"],
      ["git-history-file-menu-copy-remote-link-markdown", "copyRemoteLinkMarkdown"],
    ] as const) {
      fireEvent.click(screen.getByTestId(testId));
      expect(onGitAction).toHaveBeenLastCalledWith(action);
    }
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
