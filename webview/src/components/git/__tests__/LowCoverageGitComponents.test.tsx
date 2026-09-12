// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FileDiffView } from "@gitview/types";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import { ConflictsConfirmModal } from "../../conflict-list/conflictsDialog/ConflictsConfirmModal";
import { DiffPreviewOverlay } from "../DiffPreviewOverlay";
import { TagsPopup } from "../TagsPopup";
import { useDiffPreviewStore } from "../../../stores/diffPreviewStore";

vi.mock("../GitHistoryDiffViewer", () => ({
  GitHistoryDiffViewer: () => (
    <div data-testid="mock-history-diff-viewer">diff preview</div>
  ),
}));

const diff: FileDiffView = {
  layout: "split",
  status: "M",
  binary: false,
  left: { label: "HEAD", text: "old\n" },
  right: { label: "Working tree", text: "new\n" },
};

const tagSnapshot: TagListSnapshot = {
  repoId: "repo-1",
  refreshedAt: 0,
  tags: [
    {
      repoId: "repo-1",
      name: "v1.2.3",
      sha: "abc1234",
      annotated: true,
    },
  ],
};

describe("Git component interactions", () => {
  beforeEach(() => {
    useDiffPreviewStore.getState().closeDiffPreview();
  });

  afterEach(() => {
    cleanup();
    useDiffPreviewStore.getState().closeDiffPreview();
  });

  it("confirms or cancels closing with unresolved conflicts", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConflictsConfirmModal onCancel={onCancel} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, Close" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes a diff preview from Escape, the backdrop, or the close button", () => {
    render(<DiffPreviewOverlay />);
    act(() => {
      useDiffPreviewStore.getState().openDiffPreview({
        title: "app.ts",
        relativePath: "src/app.ts",
        diff,
      });
    });

    expect(screen.getByRole("dialog", { name: "app.ts" })).toBeTruthy();
    expect(screen.getByTestId("mock-history-diff-viewer")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "app.ts" })).toBeNull();

    act(() => {
      useDiffPreviewStore.getState().openDiffPreview({
        title: "app.ts",
        relativePath: "src/app.ts",
        diff,
      });
    });
    const overlay = screen.getByTestId("git-diff-preview-overlay");
    fireEvent.mouseDown(screen.getByRole("dialog", { name: "app.ts" }));
    expect(screen.getByRole("dialog", { name: "app.ts" })).toBeTruthy();
    fireEvent.mouseDown(overlay);
    expect(screen.queryByRole("dialog", { name: "app.ts" })).toBeNull();

    act(() => {
      useDiffPreviewStore.getState().openDiffPreview({
        title: "app.ts",
        relativePath: "src/app.ts",
        diff,
      });
    });
    fireEvent.click(screen.getByTestId("git-diff-preview-close"));
    expect(screen.queryByRole("dialog", { name: "app.ts" })).toBeNull();
  });

  it("creates and acts on annotated tags", () => {
    const onCreate = vi.fn();
    const onCheckout = vi.fn();
    const onPush = vi.fn();
    const onDelete = vi.fn();
    const onRefresh = vi.fn();
    render(
      <TagsPopup
        open
        snapshot={tagSnapshot}
        onClose={vi.fn()}
        onRefresh={onRefresh}
        onCreate={onCreate}
        onCheckout={onCheckout}
        onPush={onPush}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.change(screen.getByTestId("new-tag-name"), {
      target: { value: "  release-candidate  " },
    });
    fireEvent.change(screen.getByTestId("new-tag-message"), {
      target: { value: "  Prepare release  " },
    });
    fireEvent.click(screen.getByTestId("create-tag-button"));

    fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
    fireEvent.click(screen.getByRole("button", { name: "Push" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith(
      "release-candidate",
      "Prepare release",
    );
    expect(onCheckout).toHaveBeenCalledWith("v1.2.3");
    expect(onPush).toHaveBeenCalledWith("v1.2.3");
    expect(onDelete).toHaveBeenCalledWith("v1.2.3");
    expect(screen.getByTestId<HTMLInputElement>("new-tag-name").value).toBe("");
    expect(screen.getByTestId<HTMLInputElement>("new-tag-message").value).toBe("");
  });
});
