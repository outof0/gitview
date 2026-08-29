// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { GitWorkspaceApp } from "../../GitWorkspaceApp";
import { installGitWorkspaceVisualHost } from "../../../dev/gitWorkspaceVisualFixtures";
import { __resetVsCodeApiForTests } from "../../../hooks/useVsCodeApi";
import {
  WEBVIEW_THEME_FALLBACKS,
  applyWebviewTheme,
  ensureWebviewThemeStyle,
  readChromeThemeVars,
} from "../../../lib/webviewTheme";
import { useGitWorkspaceStore } from "../../../stores/gitWorkspaceStore";

const PENCIL_DARK = ["#18181b", "#202126", "#e8e8ea"];

async function renderChangedWorkspace() {
  installGitWorkspaceVisualHost("changed");
  render(<GitWorkspaceApp />);
  await waitFor(() => {
    expect(screen.getByTestId("git-workspace-app")).toBeTruthy();
    expect(screen.getByTestId("workspace-tab-bar")).toBeTruthy();
    expect(screen.getByTestId("workspace-log-panel")).toBeTruthy();
    expect(screen.getByTestId("log-filters")).toBeTruthy();
  });
}

describe("Git Workspace theme and chrome", () => {
  beforeEach(() => {
    __resetVsCodeApiForTests();
    useGitWorkspaceStore.setState({
      loading: true,
      repoSnapshot: null,
      statusSnapshot: null,
      error: null,
    });
    ensureWebviewThemeStyle();
  });

  afterEach(() => {
    cleanup();
    __resetVsCodeApiForTests();
    document.body.className = "";
    document.documentElement.className = "";
    document.getElementById("nx-webview-theme-fallbacks")?.remove();
    for (const name of [
      "--vscode-sideBar-background",
      "--vscode-gitDecoration-modifiedResourceForeground",
    ]) {
      document.documentElement.style.removeProperty(name);
    }
  });

  it("renders the Git Bottom Panel regions for a changed fixture", async () => {
    applyWebviewTheme("dark");
    await renderChangedWorkspace();

    expect(screen.getByTestId("workspace-tab-bar").textContent).toContain(
      "Log",
    );
    expect(screen.getByTestId("workspace-tab-log")).toBeTruthy();
    expect(screen.getByTestId("git-panel-add-tab")).toBeTruthy();
    expect(screen.getByTestId("git-panel-settings")).toBeTruthy();
    expect(screen.getByTestId("git-panel-collapse")).toBeTruthy();
    expect(screen.getByTestId("workspace-log-panel")).toBeTruthy();
    expect(screen.getByTestId("workspace-log-files-pane")).toBeTruthy();
    expect(screen.getByTestId("workspace-log-details-pane")).toBeTruthy();
    expect(screen.queryByTestId("workspace-changes")).toBeNull();
    expect(screen.queryByTestId("gitview-commit-panel")).toBeNull();
  });

  it("restyles chrome and status tokens when the body class switches to light", async () => {
    applyWebviewTheme("dark");
    await renderChangedWorkspace();
    const app = screen.getByTestId("git-workspace-app");
    expect(app.className).toContain("vscode-dark");

    const darkVars = readChromeThemeVars(document.body);
    expect(darkVars.background.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.dark.sidebarBackground,
    );

    applyWebviewTheme("light");
    await waitFor(() => {
      expect(screen.getByTestId("git-workspace-app").className).toContain(
        "vscode-light",
      );
    });
    const lightVars = readChromeThemeVars(document.body);
    expect(lightVars.background.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.light.sidebarBackground,
    );
    expect(lightVars.foreground.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.light.editorForeground,
    );
    expect(lightVars.modified.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.light.modified,
    );
    expect(lightVars.background).not.toBe(darkVars.background);
    expect(lightVars.modified).not.toBe(darkVars.modified);
    for (const value of [
      lightVars.background,
      lightVars.foreground,
      lightVars.modified,
    ]) {
      expect(PENCIL_DARK).not.toContain(value.toLowerCase());
    }

    document.documentElement.style.setProperty(
      "--vscode-sideBar-background",
      "#0a1b2c",
    );
    document.documentElement.style.setProperty(
      "--vscode-gitDecoration-modifiedResourceForeground",
      "#3d2a10",
    );
    expect(readChromeThemeVars(document.body).background).toBe("#0a1b2c");
    expect(readChromeThemeVars(document.body).modified).toBe("#3d2a10");
    expect(screen.getByTestId("workspace-tab-bar")).toBeTruthy();
    expect(screen.getByTestId("workspace-log-panel")).toBeTruthy();
  });
});
