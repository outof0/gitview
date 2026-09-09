// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceChangesPanel } from "../WorkspaceChangesPanel";
import type { GitFileStatus } from "@gitview/shared/types/status";

function file(path: string, kind: GitFileStatus["kind"]): GitFileStatus {
  return {
    repoId: "repo-1",
    path,
    kind,
    indexStatus: " ",
    workingTreeStatus: "M",
    staged: false,
    conflicted: kind === "conflicted",
    binary: false,
  };
}

describe("WorkspaceChangesPanel", () => {
  afterEach(() => cleanup());

  it("groups files into Changes, Unversioned, and Conflicts sections", () => {
    render(
      <WorkspaceChangesPanel
        files={[
          file("src/app.ts", "modified"),
          file("notes.txt", "unversioned"),
          file("both.ts", "conflicted"),
        ]}
        selectedPath={null}
        commitScope={new Set(["src/app.ts"])}
        onSelectFile={vi.fn()}
        onToggleCommitScope={vi.fn()}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    expect(screen.getByTestId("changes-tracked")).toBeTruthy();
    expect(screen.getByTestId("changes-unversioned")).toBeTruthy();
    expect(screen.getByTestId("changes-conflicts")).toBeTruthy();
    expect(screen.getByTestId("change-row-src/app.ts")).toBeTruthy();
    expect(screen.getByTestId("change-status-src/app.ts").className).toContain(
      "nx-file-status-modified",
    );
    expect(screen.getByTestId("change-status-notes.txt").className).toContain(
      "nx-file-status-untracked",
    );
    expect(screen.getByTestId("change-status-both.ts").className).toContain(
      "nx-file-status-conflict",
    );
    expect(screen.getByTestId("change-status-src/app.ts").textContent).toBe("M");
    expect(screen.getByTestId("change-status-notes.txt").textContent).toBe("?");
    expect(screen.getByTestId("change-status-both.ts").textContent).toBe("!");
  });

  it("can hide the Local Changes header when a parent toolbar owns it", () => {
    render(
      <WorkspaceChangesPanel
        files={[file("src/app.ts", "modified")]}
        selectedPath={null}
        commitScope={new Set()}
        hideHeader
        onSelectFile={vi.fn()}
        onToggleCommitScope={vi.fn()}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    expect(screen.queryByText("Local Changes")).toBeNull();
    expect(screen.getByTestId("change-row-src/app.ts")).toBeTruthy();
  });

  it("selects a whole Changes section from the tree chrome", () => {
    const onSetCommitScope = vi.fn();
    render(
      <WorkspaceChangesPanel
        files={[file("src/app.ts", "modified"), file("src/b.ts", "modified")]}
        selectedPath={null}
        commitScope={new Set()}
        hideHeader
        onSelectFile={vi.fn()}
        onToggleCommitScope={vi.fn()}
        onSetCommitScope={onSetCommitScope}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("changes-tracked-select"));
    expect(onSetCommitScope).toHaveBeenCalledWith(
      new Set(["src/app.ts", "src/b.ts"]),
    );
  });

  it("shows the compare target from the current upstream", () => {
    render(
      <WorkspaceChangesPanel
        files={[file("src/app.ts", "modified")]}
        selectedPath="src/app.ts"
        commitScope={new Set()}
        compareLabel="origin/main"
        onSelectFile={vi.fn()}
        onToggleCommitScope={vi.fn()}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    expect(screen.getByTestId("changes-compare-target").textContent).toContain(
      "origin/main",
    );
    expect(
      screen.getByTestId("change-status-src/app.ts").className,
    ).toContain("nx-file-status-modified");
  });

  it("shows empty state when there are no local changes", () => {
    render(
      <WorkspaceChangesPanel
        files={[]}
        selectedPath={null}
        commitScope={new Set()}
        onSelectFile={vi.fn()}
        onToggleCommitScope={vi.fn()}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    expect(screen.getByTestId("changes-empty").textContent).toContain(
      "No local changes",
    );
  });

  it("selects a file when clicked", () => {
    const onSelect = vi.fn();
    const onOpenInEditor = vi.fn();

    render(
      <WorkspaceChangesPanel
        files={[file("src/app.ts", "modified")]}
        selectedPath={null}
        commitScope={new Set()}
        onSelectFile={onSelect}
        onOpenInEditor={onOpenInEditor}
        onToggleCommitScope={vi.fn()}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("change-row-src/app.ts").querySelector("button")!);
    expect(onSelect).toHaveBeenCalledWith("src/app.ts");
    expect(onOpenInEditor).not.toHaveBeenCalled();
  });

  it("opens a file in the editor only on double-click", () => {
    const onSelect = vi.fn();
    const onOpenInEditor = vi.fn();

    render(
      <WorkspaceChangesPanel
        files={[file("src/app.ts", "modified")]}
        selectedPath={null}
        commitScope={new Set()}
        onSelectFile={onSelect}
        onOpenInEditor={onOpenInEditor}
        onToggleCommitScope={vi.fn()}
        onStage={vi.fn()}
        onUnstage={vi.fn()}
        onRollback={vi.fn()}
      />,
    );

    const fileButton = screen
      .getByTestId("change-row-src/app.ts")
      .querySelector("button")!;
    fireEvent.doubleClick(fileButton);

    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenInEditor).toHaveBeenCalledWith("src/app.ts");
  });
});
