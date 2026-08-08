// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BranchesPopup } from "../BranchesPopup";
import type { BranchListSnapshot } from "@gitview/shared/types/branch";

const snapshot: BranchListSnapshot = {
  repoId: "repo-1",
  refreshedAt: Date.now(),
  branches: [
    {
      repoId: "repo-1",
      name: "main",
      fullName: "main",
      remote: false,
      current: true,
      upstream: null,
      headSha: "abc1234",
      favorite: true,
    },
    {
      repoId: "repo-1",
      name: "feature",
      fullName: "feature",
      remote: false,
      current: false,
      upstream: null,
      headSha: "def5678",
    },
  ],
};

describe("branch favorite UI", () => {
  afterEach(() => cleanup());

  it("renders favorites section and toggles favorite from menu", () => {
    const onFavorite = vi.fn();
    render(
      <BranchesPopup
        open
        snapshot={snapshot}
        onClose={vi.fn()}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onFavorite={onFavorite}
      />,
    );

    expect(screen.getByTestId("branches-favorites")).toBeTruthy();
    fireEvent.click(screen.getByTestId("branch-menu-feature"));
    fireEvent.click(screen.getByTestId("branch-favorite-feature"));
    expect(onFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ name: "feature" }),
    );
  });
});