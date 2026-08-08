// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommitPanel } from "../CommitPanel";
import type { GitFileStatus } from "@gitview/shared/types/status";

function file(path: string): GitFileStatus {
  return {
    repoId: "r1",
    path,
    kind: "modified",
    indexStatus: " ",
    workingTreeStatus: "M",
    staged: false,
    conflicted: false,
    binary: false,
  };
}

describe("CommitPanel", () => {
  afterEach(() => cleanup());

  it("shows selected files in commit scope and requires a message", () => {
    const onCommit = vi.fn();
    render(
      <CommitPanel
        files={[file("src/a.ts"), file("src/b.ts")]}
        commitScope={new Set(["src/a.ts"])}
        message=""
        amend={false}
        signoff={false}
        gpgSign={false}
        author=""
        runChecks={false}
        busy={false}
        onMessageChange={vi.fn()}
        onAmendChange={vi.fn()}
        onSignoffChange={vi.fn()}
        onGpgSignChange={vi.fn()}
        onAuthorChange={vi.fn()}
        onRunChecksChange={vi.fn()}
        onCommit={onCommit}
        onCommitAndPush={vi.fn()}
      />,
    );

    expect(screen.getByTestId("commit-scope-src/a.ts")).toBeTruthy();
    expect(
      (screen.getByTestId("commit-button") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.change(screen.getByTestId("commit-message"), {
      target: { value: "Fix bug" },
    });
    expect(screen.getByTestId("commit-scope-src/a.ts")).toBeTruthy();
  });

  it("disables amend on protected branches", () => {
    render(
      <CommitPanel
        files={[file("src/a.ts")]}
        commitScope={new Set(["src/a.ts"])}
        message="Ship it"
        amend={false}
        signoff={false}
        gpgSign={false}
        author=""
        runChecks={false}
        busy={false}
        protectedBranch
        onMessageChange={vi.fn()}
        onAmendChange={vi.fn()}
        onSignoffChange={vi.fn()}
        onGpgSignChange={vi.fn()}
        onAuthorChange={vi.fn()}
        onRunChecksChange={vi.fn()}
        onCommit={vi.fn()}
        onCommitAndPush={vi.fn()}
      />,
    );
    expect(screen.getByTestId("commit-protected-warning")).toBeTruthy();
    expect((screen.getByTestId("commit-amend") as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it("commits when message and scope are present", () => {
    const onCommit = vi.fn();
    render(
      <CommitPanel
        files={[file("src/a.ts")]}
        commitScope={new Set(["src/a.ts"])}
        message="Ship it"
        amend={false}
        signoff={true}
        gpgSign={false}
        author=""
        runChecks={false}
        busy={false}
        onMessageChange={vi.fn()}
        onAmendChange={vi.fn()}
        onSignoffChange={vi.fn()}
        onGpgSignChange={vi.fn()}
        onAuthorChange={vi.fn()}
        onRunChecksChange={vi.fn()}
        onCommit={onCommit}
        onCommitAndPush={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("commit-button"));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});