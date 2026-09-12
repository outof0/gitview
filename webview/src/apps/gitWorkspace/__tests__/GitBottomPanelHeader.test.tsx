// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitBottomPanelHeader } from "../GitBottomPanelHeader";
import type { GitWorkspaceController } from "../gitWorkspaceControllerTypes";

function context() {
  const setWorkspaceTab = vi.fn();
  const setLogFilters = vi.fn();
  const resetLogView = vi.fn();
  const collapsePanel = vi.fn();
  const toggleSidebar = vi.fn();
  return {
    ctx: {
      workspaceTab: "log",
      setWorkspaceTab,
      logFilters: { range: "all", limit: 200, compactRows: false },
      logRootRequest: 0,
      setLogFilters,
      resetLogView,
      historyOpenRequest: null,
      activeHistoryScope: null,
      setActiveHistoryScope: vi.fn(),
      clientRef: { current: { collapsePanel, toggleSidebar } },
      activeRepo: { currentBranch: "feature/workspace-home" },
    } as unknown as GitWorkspaceController,
    setWorkspaceTab,
    setLogFilters,
    resetLogView,
    collapsePanel,
    toggleSidebar,
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
    expect(screen.getByTestId("git-panel-toggle-commit-sidebar")).toBeTruthy();
    expect(screen.getByTestId("git-panel-settings")).toBeTruthy();
    expect(screen.getByTestId("git-panel-collapse")).toBeTruthy();
  });

  it("adds another Log tab instead of opening other workspace surfaces", () => {
    const { ctx, setWorkspaceTab, resetLogView } = context();
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
    expect(resetLogView).toHaveBeenCalledTimes(1);
  });

  it("starts a new Log tab with repository-root filters", () => {
    const value = context();
    value.ctx.logFilters = {
      range: "incoming",
      limit: 10,
      branch: "feature/old",
      path: "packages/old",
      isFolder: true,
      compactRows: true,
    };
    render(<GitBottomPanelHeader ctx={value.ctx} />);

    fireEvent.click(screen.getByTestId("git-panel-add-tab"));

    expect(value.resetLogView).toHaveBeenCalledTimes(1);
    expect(value.ctx.setActiveHistoryScope).toHaveBeenCalledWith(null);
  });

  it("activates the first Log tab when the host requests the root", () => {
    const value = context();
    value.ctx.logFilters = {
      range: "incoming",
      limit: 10,
      branch: "feature/old",
      path: "packages/old",
      isFolder: false,
      compactRows: true,
    };
    const view = render(<GitBottomPanelHeader ctx={value.ctx} />);
    value.ctx.logRootRequest = 1;
    view.rerender(<GitBottomPanelHeader ctx={value.ctx} />);

    expect(
      screen.getByTestId("workspace-tab-log").getAttribute("aria-current"),
    ).toBe("page");
    expect(value.ctx.setWorkspaceTab).toHaveBeenCalledWith("log");
    expect(value.ctx.setActiveHistoryScope).toHaveBeenCalledWith(null);
    expect(value.setLogFilters).toHaveBeenCalledWith({
      range: "all",
      limit: 200,
    });
  });

  it("collapses the panel through the host", () => {
    const { ctx, collapsePanel } = context();
    render(<GitBottomPanelHeader ctx={ctx} />);
    fireEvent.click(screen.getByTestId("git-panel-collapse"));
    expect(collapsePanel).toHaveBeenCalledTimes(1);
  });

  it("toggles the Commit sidebar through the Git panel", () => {
    const { ctx, toggleSidebar } = context();
    render(<GitBottomPanelHeader ctx={ctx} />);

    fireEvent.click(screen.getByTestId("git-panel-toggle-commit-sidebar"));

    expect(toggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("adds and activates a scoped History tab requested by the host", () => {
    const value = context();
    value.ctx.historyOpenRequest = {
      repoId: "repo-1",
      path: "src/config",
      isFolder: true,
    };
    render(<GitBottomPanelHeader ctx={value.ctx} />);

    expect(screen.getByText("History · config/")).toBeTruthy();
    expect(value.ctx.setLogFilters).toHaveBeenCalledWith(
      expect.objectContaining({ path: "src/config", isFolder: true }),
    );
    expect(value.ctx.setActiveHistoryScope).toHaveBeenCalledWith(
      value.ctx.historyOpenRequest,
    );
  });
});
