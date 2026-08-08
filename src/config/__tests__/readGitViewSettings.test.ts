import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_GITVIEW_SETTINGS,
  isGitViewSettings,
} from "../../types/settings";

const get = vi.fn();

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({ get })),
  },
  window: {
    activeColorTheme: { kind: 2 },
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
  },
}));

import {
  readGitViewSettings,
  themeKindFromVscode,
} from "../readGitViewSettings";
import * as vscode from "vscode";

describe("readGitViewSettings", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(
      (_key: string, defaultValue: unknown) => defaultValue,
    );
  });

  it("returns defaults when configuration keys are unset", () => {
    expect(readGitViewSettings()).toEqual(DEFAULT_GITVIEW_SETTINGS);
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("gitView");
  });

  it("maps overridden values from VS Code configuration", () => {
    get.mockImplementation((key: string, defaultValue: unknown) => {
      const overrides: Record<string, unknown> = {
        mergeEngine: "markers",
        autoStageOnResolved: false,
        showBasePanel: true,
        highlightingMode: "words",
      };
      return overrides[key] ?? defaultValue;
    });

    const settings = readGitViewSettings();
    expect(settings.mergeEngine).toBe("markers");
    expect(settings.autoStageOnResolved).toBe(false);
    expect(settings.showBasePanel).toBe(true);
    expect(settings.highlightingMode).toBe("words");
    expect(settings.acceptBothOrder).toBe(
      DEFAULT_GITVIEW_SETTINGS.acceptBothOrder,
    );
  });

  it("falls back to defaults for invalid configuration values", () => {
    get.mockImplementation((key: string, defaultValue: unknown) => {
      const overrides: Record<string, unknown> = {
        mergeEngine: "legacy",
        acceptBothOrder: "random",
        autoStageOnResolved: "false",
        showBasePanel: true,
        whitespacePolicy: "ignoreEverything",
      };
      return overrides[key] ?? defaultValue;
    });

    const settings = readGitViewSettings();
    expect(settings.mergeEngine).toBe(DEFAULT_GITVIEW_SETTINGS.mergeEngine);
    expect(settings.acceptBothOrder).toBe(
      DEFAULT_GITVIEW_SETTINGS.acceptBothOrder,
    );
    expect(settings.autoStageOnResolved).toBe(
      DEFAULT_GITVIEW_SETTINGS.autoStageOnResolved,
    );
    expect(settings.showBasePanel).toBe(true);
    expect(settings.whitespacePolicy).toBe(
      DEFAULT_GITVIEW_SETTINGS.whitespacePolicy,
    );
  });

  it("validates complete settings payloads", () => {
    expect(isGitViewSettings(DEFAULT_GITVIEW_SETTINGS)).toBe(true);
    expect(
      isGitViewSettings({
        mergeEngine: "threeWay",
        highlightingMode: "lines",
      }),
    ).toBe(false);
    expect(
      isGitViewSettings({
        ...DEFAULT_GITVIEW_SETTINGS,
        goToNextFileAfterLastChange: "sometimes",
      }),
    ).toBe(false);
  });
});

describe("themeKindFromVscode", () => {
  it("maps VS Code theme kinds", () => {
    Object.assign(vscode.window.activeColorTheme, {
      kind: vscode.ColorThemeKind.Light,
    });
    expect(themeKindFromVscode()).toBe("light");

    Object.assign(vscode.window.activeColorTheme, {
      kind: vscode.ColorThemeKind.HighContrast,
    });
    expect(themeKindFromVscode()).toBe("high-contrast");

    Object.assign(vscode.window.activeColorTheme, {
      kind: vscode.ColorThemeKind.HighContrastLight,
    });
    expect(themeKindFromVscode()).toBe("high-contrast-light");

    Object.assign(vscode.window.activeColorTheme, {
      kind: vscode.ColorThemeKind.Dark,
    });
    expect(themeKindFromVscode()).toBe("dark");
  });
});
