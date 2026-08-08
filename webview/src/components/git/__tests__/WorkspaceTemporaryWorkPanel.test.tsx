// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceTemporaryWorkPanel } from "../WorkspaceTemporaryWorkPanel";

const baseProps = {
  onSubTabChange: vi.fn(),
  patchPreview: null,
  onRefreshStash: vi.fn(),
  onRefreshShelf: vi.fn(),
  onOpenStashDialog: vi.fn(),
  onOpenUnstashDialog: vi.fn(),
  onApplyStash: vi.fn(),
  onPopStash: vi.fn(),
  onDropStash: vi.fn(),
  onShelveSelected: vi.fn(),
  onUnshelve: vi.fn(),
  onDeleteShelf: vi.fn(),
  onCreatePatch: vi.fn(),
  onApplyPatchClipboard: vi.fn(),
  onImportShelfPatch: vi.fn(),
};

describe("WorkspaceTemporaryWorkPanel", () => {
  afterEach(() => cleanup());

  it("opens the stash dialog from the toolbar", () => {
    const onOpenStashDialog = vi.fn();
    render(
      <WorkspaceTemporaryWorkPanel
        {...baseProps}
        subTab="stash"
        stashSnapshot={{ repoId: "r1", stashes: [], refreshedAt: Date.now() }}
        shelfSnapshot={null}
        selectedPaths={[]}
        onOpenStashDialog={onOpenStashDialog}
      />,
    );

    fireEvent.click(screen.getByTestId("stash-open-stash-dialog"));
    expect(onOpenStashDialog).toHaveBeenCalled();
  });

  it("disables Unstash when there are no stashes", () => {
    render(
      <WorkspaceTemporaryWorkPanel
        {...baseProps}
        subTab="stash"
        stashSnapshot={{ repoId: "r1", stashes: [], refreshedAt: Date.now() }}
        shelfSnapshot={null}
        selectedPaths={[]}
      />,
    );

    expect(
      screen.getByTestId<HTMLButtonElement>("stash-open-unstash-dialog")
        .disabled,
    ).toBe(true);
  });

  it("switches to shelf sub-tab", () => {
    const onSubTabChange = vi.fn();
    render(
      <WorkspaceTemporaryWorkPanel
        {...baseProps}
        subTab="stash"
        onSubTabChange={onSubTabChange}
        stashSnapshot={null}
        shelfSnapshot={{ repoId: "r1", shelves: [], refreshedAt: Date.now() }}
        selectedPaths={["src/a.ts"]}
      />,
    );

    fireEvent.click(screen.getByTestId("temporary-subtab-shelf"));
    expect(onSubTabChange).toHaveBeenCalledWith("shelf");
  });
});
