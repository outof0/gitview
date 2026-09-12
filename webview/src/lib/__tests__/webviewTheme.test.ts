/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  WEBVIEW_THEME_FALLBACKS,
  applyPlaygroundThemeVars,
  applyWebviewTheme,
  detectWebviewThemeKind,
  ensureWebviewThemeStyle,
  readChromeThemeVars,
  webviewThemeFallbackCss,
} from "../webviewTheme";

const PENCIL_DARK = ["#18181b", "#202126", "#e8e8ea"];

describe("webviewTheme", () => {
  afterEach(() => {
    document.body.className = "";
    document.documentElement.className = "";
    document.getElementById("nx-webview-theme-fallbacks")?.remove();
    for (const name of [
      "--vscode-editor-background",
      "--vscode-sideBar-background",
      "--vscode-gitDecoration-modifiedResourceForeground",
    ]) {
      document.documentElement.style.removeProperty(name);
    }
  });

  it("maps body classes to theme kinds", () => {
    expect(detectWebviewThemeKind("vscode-light")).toBe("light");
    expect(detectWebviewThemeKind("vscode-dark")).toBe("dark");
    expect(detectWebviewThemeKind("vscode-high-contrast")).toBe("high-contrast");
  });

  it("uses distinct dark vs light fallbacks, not the Pencil mock hexes", () => {
    const dark = WEBVIEW_THEME_FALLBACKS.dark;
    const light = WEBVIEW_THEME_FALLBACKS.light;
    expect(dark.editorBackground).not.toBe(light.editorBackground);
    expect(dark.sidebarBackground).not.toBe(light.sidebarBackground);
    expect(dark.modified).not.toBe(light.modified);
    expect(dark.added).not.toBe(light.added);
    for (const value of Object.values(light)) {
      expect(PENCIL_DARK).not.toContain(value.toLowerCase());
    }
  });

  it("falls back by theme kind when the host has not injected VS Code tokens", () => {
    ensureWebviewThemeStyle();
    applyWebviewTheme("dark");
    const darkVars = readChromeThemeVars(document.body);
    expect(darkVars.background.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.dark.sidebarBackground,
    );
    expect(darkVars.foreground.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.dark.editorForeground,
    );
    expect(darkVars.modified.toLowerCase()).toBe(
      WEBVIEW_THEME_FALLBACKS.dark.modified,
    );

    applyWebviewTheme("light");
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
    expect(PENCIL_DARK).not.toContain(lightVars.background.toLowerCase());
  });

  it("lets injected VS Code theme tokens win over dark and light fallbacks", () => {
    ensureWebviewThemeStyle();
    document.documentElement.style.setProperty(
      "--vscode-sideBar-background",
      "#112233",
    );
    document.documentElement.style.setProperty(
      "--vscode-editor-foreground",
      "#fedcba",
    );
    document.documentElement.style.setProperty(
      "--vscode-gitDecoration-modifiedResourceForeground",
      "#445566",
    );

    applyWebviewTheme("dark");
    expect(readChromeThemeVars(document.body)).toMatchObject({
      background: "#112233",
      foreground: "#fedcba",
      modified: "#445566",
    });

    applyWebviewTheme("light");
    expect(readChromeThemeVars(document.body)).toMatchObject({
      background: "#112233",
      foreground: "#fedcba",
      modified: "#445566",
    });
  });

  it("does not overwrite VS Code tokens already present on the host", () => {
    document.documentElement.style.setProperty(
      "--vscode-sideBar-background",
      "#0f172a",
    );
    applyPlaygroundThemeVars(document.documentElement, "light");
    expect(
      document.documentElement.style.getPropertyValue(
        "--vscode-sideBar-background",
      ),
    ).toBe("#0f172a");
  });

  it("keeps VS Code git-decoration tokens ahead of fallbacks", () => {
    const css = webviewThemeFallbackCss();
    expect(css).toContain(
      "--nx-chrome-bg: var(--vscode-sideBar-background,",
    );
    expect(css).toContain("--vscode-gitDecoration-addedResourceForeground");
    expect(css).toContain("--vscode-gitDecoration-modifiedResourceForeground");
    expect(css).toContain("--vscode-gitDecoration-deletedResourceForeground");
    expect(css).toContain("--vscode-gitDecoration-untrackedResourceForeground");
    expect(css).toContain("--vscode-gitDecoration-conflictingResourceForeground");
    expect(css).toContain("body.vscode-light");
    expect(css).toContain("body.vscode-dark");
  });
});
