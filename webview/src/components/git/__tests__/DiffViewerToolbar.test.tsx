// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DiffViewerToolbar } from "../DiffViewerToolbar";
import {
  DEFAULT_DIFF_VIEWER_OPTIONS,
  type DiffViewerOptions,
} from "../MonacoDiffViewer";

afterEach(() => cleanup());

function renderToolbar(
  overrides: Partial<DiffViewerOptions> = {},
  diffCount: number | null = 3,
) {
  const onOptionsChange = vi.fn();
  const onPrevDifference = vi.fn();
  const onNextDifference = vi.fn();
  render(
    <DiffViewerToolbar
      options={{ ...DEFAULT_DIFF_VIEWER_OPTIONS, ...overrides }}
      onOptionsChange={onOptionsChange}
      onPrevDifference={onPrevDifference}
      onNextDifference={onNextDifference}
      diffCount={diffCount}
    />,
  );
  return { onOptionsChange, onPrevDifference, onNextDifference };
}

describe("DiffViewerToolbar", () => {
  it("pluralizes the difference counter", () => {
    renderToolbar({}, 1);
    expect(screen.getByTestId("git-diff-difference-counter").textContent).toBe(
      "1 difference",
    );
    cleanup();

    renderToolbar({}, 4);
    expect(screen.getByTestId("git-diff-difference-counter").textContent).toBe(
      "4 differences",
    );
  });

  it("reports identical contents and disables navigation when there is no diff", () => {
    renderToolbar({}, 0);
    expect(screen.getByTestId("git-diff-difference-counter").textContent).toBe(
      "Contents are identical",
    );
    expect(
      screen.getByTestId<HTMLButtonElement>("git-diff-prev-difference").disabled,
    ).toBe(true);
    expect(
      screen.getByTestId<HTMLButtonElement>("git-diff-next-difference").disabled,
    ).toBe(true);
  });

  it("navigates between differences", () => {
    const { onPrevDifference, onNextDifference } = renderToolbar();
    fireEvent.click(screen.getByTestId("git-diff-next-difference"));
    fireEvent.click(screen.getByTestId("git-diff-prev-difference"));
    expect(onNextDifference).toHaveBeenCalledTimes(1);
    expect(onPrevDifference).toHaveBeenCalledTimes(1);
  });

  it("switches to the unified viewer", () => {
    const { onOptionsChange } = renderToolbar();
    fireEvent.click(screen.getByTestId("git-diff-viewer-mode"));
    fireEvent.click(screen.getByTestId("git-diff-viewer-mode-unified"));
    expect(onOptionsChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_VIEWER_OPTIONS,
      sideBySide: false,
    });
  });

  it("selects the trim whitespace policy", () => {
    const { onOptionsChange } = renderToolbar();
    fireEvent.click(screen.getByTestId("git-diff-whitespace"));
    fireEvent.click(screen.getByTestId("git-diff-whitespace-trimWhitespaces"));
    expect(onOptionsChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_VIEWER_OPTIONS,
      trimWhitespace: true,
    });
  });

  it("toggles collapse unchanged fragments off again", () => {
    const { onOptionsChange } = renderToolbar({ collapseUnchanged: true });
    fireEvent.click(screen.getByTestId("git-diff-view-options"));
    fireEvent.click(
      screen.getByTestId("git-diff-view-options-collapseUnchanged"),
    );
    expect(onOptionsChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_VIEWER_OPTIONS,
      collapseUnchanged: false,
    });
  });

  it("toggles soft wraps", () => {
    const { onOptionsChange } = renderToolbar();
    fireEvent.click(screen.getByTestId("git-diff-view-options"));
    fireEvent.click(screen.getByTestId("git-diff-view-options-softWrap"));
    expect(onOptionsChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_VIEWER_OPTIONS,
      softWrap: true,
    });
  });
});
