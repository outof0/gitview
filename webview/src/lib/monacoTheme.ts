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

function themeBase(kind: ThemeKind): "vs" | "vs-dark" | "hc-black" | "hc-light" {
  switch (kind) {
    case "light":
      return "vs";
    case "high-contrast-light":
      return "hc-light";
    case "high-contrast":
      return "hc-black";
    default:
      return "vs-dark";
  }
}

function vscodeColor(...names: string[]): string {
  const fallback = names[names.length - 1] ?? "";
  if (typeof document === "undefined") {
    return fallback;
  }
  const targets = [document.body, document.documentElement];
  for (const name of names) {
    if (!name.startsWith("--")) {
      return name;
    }
    for (const el of targets) {
      if (!el) {
        continue;
      }
      const value = getComputedStyle(el).getPropertyValue(name).trim();
      if (value) {
        return toMonacoColor(value);
      }
    }
  }
  return fallback;
}

function toMonacoColor(value: string): string {
  const match = value.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i,
  );
  if (!match) {
    return value;
  }
  const byte = (component: string) =>
    Math.max(0, Math.min(255, Math.round(Number(component))))
      .toString(16)
      .padStart(2, "0");
  const alpha = match[4]
    ? byte(String(Number(match[4]) * 255))
    : "ff";
  return `#${byte(match[1]!)}${byte(match[2]!)}${byte(match[3]!)}${alpha}`;
}

const DARK_SYNTAX_RULES: Monaco.editor.ITokenThemeRule[] = [
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
];

const LIGHT_SYNTAX_RULES: Monaco.editor.ITokenThemeRule[] = [
  { token: "comment", foreground: "008000", fontStyle: "italic" },
  { token: "string", foreground: "A31515" },
  { token: "keyword", foreground: "0000FF" },
  { token: "number", foreground: "098658" },
  { token: "type", foreground: "267F99" },
  { token: "function", foreground: "795E26" },
  { token: "variable", foreground: "001080" },
];

function syntaxRules(kind: ThemeKind): Monaco.editor.ITokenThemeRule[] {
  return kind === "light" || kind === "high-contrast-light"
    ? LIGHT_SYNTAX_RULES
    : DARK_SYNTAX_RULES;
}

/**
 * Register Monaco themes that keep rich syntax colors but never paint
 * per-line content backgrounds (only selection / find may tint).
 */
function registerGitViewMonacoThemes(monaco: typeof Monaco): void {
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
    rules: DARK_SYNTAX_RULES,
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
    rules: LIGHT_SYNTAX_RULES,
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
  const light = kind === "light" || kind === "high-contrast-light";
  const background = vscodeColor(
    "--vscode-editor-background",
    light ? "#ffffff" : "#1e1e1e",
  );
  const foreground = vscodeColor(
    "--vscode-editor-foreground",
    light ? "#3b3b3b" : "#d4d4d4",
  );
  monaco.editor.defineTheme(id, {
    base: themeBase(kind),
    inherit: true,
    rules: syntaxRules(kind),
    colors: {
      "editor.background": background,
      "editor.foreground": foreground,
      "editorGutter.background": vscodeColor(
        "--vscode-editorGutter-background",
        background,
      ),
      "editorLineNumber.foreground": vscodeColor(
        "--vscode-editorLineNumber-foreground",
        light ? "#767676" : "#858585",
      ),
      "editorLineNumber.activeForeground": vscodeColor(
        "--vscode-editorLineNumber-activeForeground",
        foreground,
      ),
      "editorCursor.foreground": vscodeColor(
        "--vscode-editorCursor-foreground",
        foreground,
      ),
      "editor.selectionBackground": vscodeColor(
        "--vscode-editor-selectionBackground",
        light ? "#add6ff" : "#264f78",
      ),
      "editor.inactiveSelectionBackground": vscodeColor(
        "--vscode-editor-inactiveSelectionBackground",
        light ? "#e5ebf1" : "#3a3d41",
      ),
      "editor.selectionHighlightBackground": vscodeColor(
        "--vscode-editor-selectionHighlightBackground",
        "#00000000",
      ),
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#00000000",
      "editorIndentGuide.activeBackground1": "#00000000",
      "diffEditor.insertedTextBackground": vscodeColor(
        "--vscode-diffEditor-insertedTextBackground",
        light ? "#9ccc9c33" : "#2ea04338",
      ),
      "diffEditor.removedTextBackground": vscodeColor(
        "--vscode-diffEditor-removedTextBackground",
        light ? "#ff9b9b33" : "#f8514938",
      ),
      "diffEditor.insertedLineBackground": vscodeColor(
        "--vscode-diffEditor-insertedLineBackground",
        "--vscode-diffEditor-insertedTextBackground",
        light ? "#9ccc9c22" : "#2ea04322",
      ),
      "diffEditor.removedLineBackground": vscodeColor(
        "--vscode-diffEditor-removedLineBackground",
        "--vscode-diffEditor-removedTextBackground",
        light ? "#ff9b9b22" : "#f8514922",
      ),
      "diffEditor.diagonalFill": vscodeColor(
        "--vscode-diffEditor-diagonalFill",
        light ? "#00000014" : "#ffffff14",
      ),
      "diffEditorOverview.insertedForeground": vscodeColor(
        "--vscode-diffEditorOverview-insertedForeground",
        "--vscode-editorGutter-addedBackground",
        light ? "#587c0c" : "#81b88b",
      ),
      "diffEditorOverview.removedForeground": vscodeColor(
        "--vscode-diffEditorOverview-removedForeground",
        "--vscode-editorGutter-deletedBackground",
        light ? "#ad0707" : "#c74e39",
      ),
    },
  });
  monaco.editor.setTheme(id);
  return id;
}
