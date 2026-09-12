// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { GitSidebarApp, GitWorkspaceApp } from "../GitWorkspaceApp";
import { installGitWorkspaceVisualHost } from "../../dev/gitWorkspaceVisualFixtures";
import { __resetVsCodeApiForTests } from "../../hooks/useVsCodeApi";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

describe("Git Workspace activity-bar sidebar", () => {
  beforeEach(() => {
    __resetVsCodeApiForTests();
    useGitWorkspaceStore.setState({
      loading: true,
      repoSnapshot: null,
      statusSnapshot: null,
      error: null,
      workspaceTab: "log",
      branchesOpen: false,
      dialogs: {},
    });
  });

  afterEach(() => {
    cleanup();
    __resetVsCodeApiForTests();
    delete window.__GITVIEW_BOOTSTRAP__;
    useGitWorkspaceStore.setState({
      loading: true,
      repoSnapshot: null,
      statusSnapshot: null,
      error: null,
      workspaceTab: "log",
      branchesOpen: false,
    });
  });

  it("opens the Changes/Commit surface instead of Log or Branches", async () => {
    installGitWorkspaceVisualHost("changed");
    render(<GitSidebarApp />);

    await waitFor(() => {
      expect(screen.getByTestId("git-workspace-app").dataset.surface).toBe(
        "sidebar",
      );
      expect(screen.getByTestId("commit-sidebar-header")).toBeTruthy();
      expect(screen.getByTestId("commit-toolbar")).toBeTruthy();
      expect(screen.getByTestId("commit-toolbar").className).toContain("w-full");
      expect(screen.getByTestId("resizable-split-vertical")).toBeTruthy();
      expect(screen.getByTestId("workspace-changes")).toBeTruthy();
      expect(screen.getByTestId("gitview-commit-panel")).toBeTruthy();
      expect(screen.queryByTestId("workspace-diff-panel")).toBeNull();
    });

    expect(screen.queryByTestId("workspace-tab-bar")).toBeNull();
    expect(screen.queryByTestId("workspace-log-panel")).toBeNull();
    expect(useGitWorkspaceStore.getState().workspaceTab).toBe("changes");
    expect(useGitWorkspaceStore.getState().branchesOpen).toBe(false);
    expect(screen.getByTestId("workspace-changes-layout").dataset.layout).toBe(
      "sidebar",
    );
  });

  it("reads the sidebar surface from the host bootstrap", async () => {
    window.__GITVIEW_BOOTSTRAP__ = { surface: "sidebar" };
    installGitWorkspaceVisualHost("changed");
    render(<GitWorkspaceApp />);

    await waitFor(() => {
      expect(screen.getByTestId("git-workspace-app").dataset.surface).toBe(
        "sidebar",
      );
      expect(screen.getByTestId("commit-sidebar-header")).toBeTruthy();
    });
  });
});
