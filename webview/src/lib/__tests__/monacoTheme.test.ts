// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyGitViewMonacoTheme, pickMonacoTheme } from "../monacoTheme";

describe("pickMonacoTheme", () => {
  it("maps VS Code webview themes to GitView Monaco themes (no line wash)", () => {
    expect(pickMonacoTheme("dark")).toBe("gitview-dark");
    expect(pickMonacoTheme("light")).toBe("gitview-light");
    expect(pickMonacoTheme("high-contrast")).toBe("gitview-hc-dark");
    expect(pickMonacoTheme("high-contrast-light")).toBe("gitview-hc-light");
  });
});

describe("applyGitViewMonacoTheme", () => {
  afterEach(() => {
    document.body.style.removeProperty(
      "--vscode-diffEditor-insertedTextBackground",
    );
    document.body.style.removeProperty(
      "--vscode-diffEditor-removedTextBackground",
    );
  });

  it("copies workbench diff colors from the webview body", () => {
    document.body.style.setProperty(
      "--vscode-diffEditor-insertedTextBackground",
      "rgba(10, 200, 80, 0.18)",
    );
    document.body.style.setProperty(
      "--vscode-diffEditor-removedTextBackground",
      "rgba(200, 40, 40, 0.18)",
    );
    const defineTheme = vi.fn();
    const monaco = {
      editor: {
        defineTheme,
        setTheme: vi.fn(),
      },
    };
    applyGitViewMonacoTheme(monaco as never, "dark");
    const colors = defineTheme.mock.calls.at(-1)?.[1]?.colors as Record<
      string,
      string
    >;
    const rules = defineTheme.mock.calls.at(-1)?.[1]?.rules as Array<{
      token: string;
      foreground: string;
    }>;
    expect(colors["diffEditor.insertedTextBackground"]).toBe(
      "#0ac8502e",
    );
    expect(colors["diffEditor.removedTextBackground"]).toBe(
      "#c828282e",
    );
    expect(rules).toEqual(
      expect.arrayContaining([
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
        { token: "type", foreground: "4EC9B0" },
      ]),
    );
  });
});
