// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitBottomPanelHeader } from "../GitBottomPanelHeader";
import type { GitWorkspaceController } from "../gitWorkspaceControllerTypes";

function context() {
  const setWorkspaceTab = vi.fn();
  const collapsePanel = vi.fn();
  return {
    ctx: {
      workspaceTab: "log",
      setWorkspaceTab,
      logFilters: { range: "all", limit: 200, compactRows: false },
      setLogFilters: vi.fn(),
      clientRef: { current: { collapsePanel } },
      activeRepo: { currentBranch: "feature/workspace-home" },
    } as unknown as GitWorkspaceController,
    setWorkspaceTab,
    collapsePanel,
  };
}

describe("GitBottomPanelHeader", () => {
  afterEach(() => cleanup());

  it("shows the Log tab, add, settings, and collapse chrome", () => {
    render(<GitBottomPanelHeader ctx={context().ctx} />);

    expect(screen.getByTestId("workspace-tab-bar")).toBeTruthy();
    expect(
      screen.getByTestId("workspace-tab-log").getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByTestId("workspace-tab-changes")).toBeNull();
    expect(screen.getByTestId("git-panel-add-tab")).toBeTruthy();
    expect(screen.getByTestId("git-panel-settings")).toBeTruthy();
    expect(screen.getByTestId("git-panel-collapse")).toBeTruthy();
  });

  it("adds another Log tab instead of opening other workspace surfaces", () => {
    const { ctx, setWorkspaceTab } = context();
    render(<GitBottomPanelHeader ctx={ctx} />);

    fireEvent.click(screen.getByTestId("git-panel-add-tab"));
    expect(screen.queryByTestId("git-panel-add-menu")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Changes" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "Temporary Work" }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Review" })).toBeNull();
    const logs = screen.getAllByText("Log");
    expect(logs.length).toBe(2);
    expect(setWorkspaceTab).toHaveBeenCalledWith("log");
  });

  it("collapses the panel through the host", () => {
    const { ctx, collapsePanel } = context();
    render(<GitBottomPanelHeader ctx={ctx} />);
    fireEvent.click(screen.getByTestId("git-panel-collapse"));
    expect(collapsePanel).toHaveBeenCalledTimes(1);
  });
});
