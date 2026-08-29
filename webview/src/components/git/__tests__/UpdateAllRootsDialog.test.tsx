// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateAllRootsDialog } from "../UpdateAllRootsDialog";

describe("UpdateAllRootsDialog", () => {
  afterEach(() => cleanup());

  it("offers retry per failed root and Changes for the active root", () => {
    const onRetryRoot = vi.fn();
    const onShowChanges = vi.fn();
    render(
      <UpdateAllRootsDialog
        open
        results={[
          { repoId: "repo-1", name: "repo", ok: false, error: "Conflict" },
          {
            repoId: "repo-2",
            name: "repo-two",
            ok: false,
            error: "Offline",
          },
        ]}
        activeRepoId="repo-1"
        retryingRepoIds={["repo-2"]}
        onRetryRoot={onRetryRoot}
        onShowChanges={onShowChanges}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("update-root-show-changes-repo-1"));
    fireEvent.click(screen.getByTestId("update-root-retry-repo-1"));

    expect(onShowChanges).toHaveBeenCalledTimes(1);
    expect(onRetryRoot).toHaveBeenCalledWith("repo-1");
    expect(screen.queryByTestId("update-root-show-changes-repo-2")).toBeNull();
    expect(screen.getByTestId("update-root-retry-repo-2")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByTestId("update-root-retry-repo-2").textContent).toBe(
      "Retrying…",
    );
  });
});
