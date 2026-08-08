// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  GIT_SUBMENU_ITEMS,
  buildGitSubmenuEnablementContext,
  getGitSubmenuItems,
} from "@gitview/types";
import { GitContextMenuItems } from "../GitContextMenuItems";

describe("GitContextMenuItems", () => {
  afterEach(() => cleanup());

  it("renders the full Git submenu from the shared manifest", () => {
    render(
      <GitContextMenuItems
        isFolder={false}
        onShowHistory={vi.fn()}
        onGitAction={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const expected = getGitSubmenuItems();
    expect(expected.length).toBe(
      GIT_SUBMENU_ITEMS.filter((row) => !("nativeOnly" in row && row.nativeOnly))
        .length,
    );

    for (const entry of expected) {
      expect(screen.getByTestId(entry.testId)).toBeTruthy();
      expect(screen.getByTestId(entry.testId).textContent).toContain(
        entry.title,
      );
    }

    // Dense IA: section headers + dividers between VCS groups
    const sections = screen.getAllByTestId("git-menu-section");
    expect(sections.map((el) => el.getAttribute("data-section"))).toEqual(
      expect.arrayContaining([
        "History",
        "Local",
        "Commit",
        "Remote",
        "Branch & temporary work",
        "Integrate",
      ]),
    );
    expect(screen.getAllByTestId("git-menu-divider").length).toBeGreaterThan(3);
  });

  it("disables file-only items for folders", () => {
    const onGitAction = vi.fn();
    render(
      <GitContextMenuItems
        isFolder={true}
        onShowHistory={vi.fn()}
        onGitAction={onGitAction}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("git-menu-rollback"));
    expect(onGitAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("git-menu-add"));
    expect(onGitAction).toHaveBeenCalledWith("add");
  });

  it("dispatches compare, show diff, rollback, and add for files", () => {
    const onGitAction = vi.fn();
    render(
      <GitContextMenuItems
        isFolder={false}
        onShowHistory={vi.fn()}
        onGitAction={onGitAction}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("git-menu-compare-revision"));
    fireEvent.click(screen.getByTestId("git-menu-show-diff"));
    fireEvent.click(screen.getByTestId("git-menu-rollback"));
    fireEvent.click(screen.getByTestId("git-menu-add"));

    expect(onGitAction).toHaveBeenCalledTimes(4);
    expect(onGitAction.mock.calls.map((c) => c[0])).toEqual([
      "compareWithRevision",
      "showDiff",
      "rollback",
      "add",
    ]);
  });

  it("hides Annotate when showAnnotate is false", () => {
    render(
      <GitContextMenuItems
        isFolder={false}
        onShowHistory={vi.fn()}
        onGitAction={vi.fn()}
        onClose={vi.fn()}
        showAnnotate={false}
      />,
    );
    expect(screen.queryByTestId("git-menu-annotate")).toBeNull();
    expect(screen.getByTestId("git-menu-show-diff")).toBeTruthy();
  });

  it("disables fetch without a remote but keeps unstash open to an empty list", () => {
    const onGitAction = vi.fn();
    render(
      <GitContextMenuItems
        isFolder={false}
        onShowHistory={vi.fn()}
        onGitAction={onGitAction}
        onClose={vi.fn()}
        enablement={buildGitSubmenuEnablementContext({
          repository: {
            upstream: "origin/main",
            ahead: 0,
            behind: 0,
            conflictCount: 0,
            dirty: true,
            trusted: true,
            operation: { type: "none" },
          },
          stashCount: 0,
          hasRemote: false,
        })}
      />,
    );

    const unstash = screen.getByTestId("git-menu-unstash") as HTMLButtonElement;
    const fetch = screen.getByTestId("git-menu-fetch") as HTMLButtonElement;
    expect(unstash.disabled).toBe(false);
    expect(fetch.disabled).toBe(true);
    expect(fetch.getAttribute("title")?.toLowerCase()).toMatch(/remote/);

    fireEvent.click(fetch);
    expect(onGitAction).not.toHaveBeenCalled();

    fireEvent.click(unstash);
    expect(onGitAction).toHaveBeenCalledWith("unstash");
  });

  it("uses onAnnotateBlame when provided", () => {
    const onAnnotateBlame = vi.fn();
    const onGitAction = vi.fn();
    render(
      <GitContextMenuItems
        isFolder={false}
        onShowHistory={vi.fn()}
        onGitAction={onGitAction}
        onClose={vi.fn()}
        onAnnotateBlame={onAnnotateBlame}
      />,
    );
    fireEvent.click(screen.getByTestId("git-menu-annotate"));
    expect(onAnnotateBlame).toHaveBeenCalled();
    expect(onGitAction).not.toHaveBeenCalled();
  });
});
