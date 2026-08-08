import type { ThemeKind } from "../hooks/useTheme";
import type * as Monaco from "monaco-editor/editor";

/** Map VS Code webview theme to a GitView Monaco theme id (no line washes). */
export function pickMonacoTheme(kind: ThemeKind): string {
  switch (kind) {
    case "light":
      return "gitview-light";
    case "high-contrast-light":
      return "gitview-hc-light";
    case "high-contrast":
      return "gitview-hc-dark";
    default:
      return "gitview-dark";
  }
}

let themesRegistered = false;

/**
 * Register Monaco themes that keep rich syntax colors but never paint
 * per-line content backgrounds (only selection / find may tint).
 */
export function registerGitViewMonacoThemes(monaco: typeof Monaco): void {
  if (themesRegistered) {
    return;
  }
  themesRegistered = true;

  const noLineWash = {
    "editor.lineHighlightBackground": "#00000000",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionHighlightBackground": "#264f7844",
    "editor.inactiveSelectionBackground": "#3a3d4144",
    "editorIndentGuide.background1": "#00000000",
    "editorIndentGuide.activeBackground1": "#00000000",
  } as const;

  monaco.editor.defineTheme("gitview-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "string", foreground: "CE9178" },
      { token: "keyword", foreground: "569CD6" },
      { token: "number", foreground: "B5CEA8" },
      { token: "type", foreground: "4EC9B0" },
      { token: "class", foreground: "4EC9B0" },
      { token: "function", foreground: "DCDCAA" },
      { token: "variable", foreground: "9CDCFE" },
      { token: "constant", foreground: "4FC1FF" },
      { token: "regexp", foreground: "D16969" },
      { token: "operator", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
      { token: "tag", foreground: "569CD6" },
      { token: "attribute.name", foreground: "9CDCFE" },
      { token: "attribute.value", foreground: "CE9178" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editorGutter.background": "#1e1e1e",
      ...noLineWash,
    },
  });

  monaco.editor.defineTheme("gitview-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "008000", fontStyle: "italic" },
      { token: "string", foreground: "A31515" },
      { token: "keyword", foreground: "0000FF" },
      { token: "number", foreground: "098658" },
      { token: "type", foreground: "267F99" },
      { token: "function", foreground: "795E26" },
      { token: "variable", foreground: "001080" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#000000",
      "editorGutter.background": "#ffffff",
      ...noLineWash,
    },
  });

  monaco.editor.defineTheme("gitview-hc-dark", {
    base: "hc-black",
    inherit: true,
    rules: [],
    colors: {
      ...noLineWash,
    },
  });

  monaco.editor.defineTheme("gitview-hc-light", {
    base: "hc-light",
    inherit: true,
    rules: [],
    colors: {
      ...noLineWash,
    },
  });
}

/** Ensure themes exist, then apply. */
export function applyGitViewMonacoTheme(
  monaco: typeof Monaco,
  kind: ThemeKind,
): string {
  registerGitViewMonacoThemes(monaco);
  const id = pickMonacoTheme(kind);
  monaco.editor.setTheme(id);
  return id;
}
