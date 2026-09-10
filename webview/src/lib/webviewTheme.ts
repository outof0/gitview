import type { ThemeKind } from "../hooks/useTheme";

/** Dark fallbacks when VS Code has not injected --vscode-* variables. */
export const WEBVIEW_THEME_FALLBACKS = {
  dark: {
    editorBackground: "#1e1e1e",
    editorForeground: "#cccccc",
    sidebarBackground: "#252526",
    description: "#9d9d9d",
    added: "#81b88b",
    modified: "#e2c08d",
    deleted: "#c74e39",
    untracked: "#73c991",
    ignored: "#8c8c8c",
    conflicted: "#e4676b",
    renamed: "#e2c08d",
  },
  light: {
    editorBackground: "#ffffff",
    editorForeground: "#3b3b3b",
    sidebarBackground: "#f3f3f3",
    description: "#616161",
    added: "#587c0c",
    modified: "#895503",
    deleted: "#ad0707",
    untracked: "#007100",
    ignored: "#8e8e90",
    conflicted: "#ad0707",
    renamed: "#895503",
  },
  "high-contrast": {
    editorBackground: "#000000",
    editorForeground: "#ffffff",
    sidebarBackground: "#000000",
    description: "#ffffff",
    added: "#00ff00",
    modified: "#6fc3df",
    deleted: "#ff0000",
    untracked: "#00ff00",
    ignored: "#a0a0a0",
    conflicted: "#f48771",
    renamed: "#6fc3df",
  },
  "high-contrast-light": {
    editorBackground: "#ffffff",
    editorForeground: "#000000",
    sidebarBackground: "#ffffff",
    description: "#000000",
    added: "#007100",
    modified: "#895503",
    deleted: "#ad0707",
    untracked: "#007100",
    ignored: "#6a737d",
    conflicted: "#ad0707",
    renamed: "#895503",
  },
} as const;

export type WebviewThemeFallbackPalette =
  (typeof WEBVIEW_THEME_FALLBACKS)[ThemeKind];

const THEME_CLASSES = [
  "vscode-dark",
  "vscode-light",
  "vscode-high-contrast",
  "vscode-high-contrast-light",
] as const;

export function detectWebviewThemeKind(
  className: string = typeof document === "undefined" ? "" : document.body.className,
): ThemeKind {
  const classes = className.split(/\s+/);
  if (classes.includes("vscode-high-contrast-light")) {
    return "high-contrast-light";
  }
  if (classes.includes("vscode-high-contrast")) {
    return "high-contrast";
  }
  if (classes.includes("vscode-light")) {
    return "light";
  }
  return "dark";
}

export function webviewThemeClass(kind: ThemeKind): (typeof THEME_CLASSES)[number] {
  switch (kind) {
    case "light":
      return "vscode-light";
    case "high-contrast":
      return "vscode-high-contrast";
    case "high-contrast-light":
      return "vscode-high-contrast-light";
    default:
      return "vscode-dark";
  }
}

function applyWebviewThemeClass(
  target: HTMLElement,
  kind: ThemeKind,
): void {
  for (const name of THEME_CLASSES) {
    target.classList.remove(name);
  }
  target.classList.add(webviewThemeClass(kind));
}

export function webviewThemeFallbackCss(): string {
  return (Object.keys(WEBVIEW_THEME_FALLBACKS) as ThemeKind[])
    .map((kind) => {
      const palette = WEBVIEW_THEME_FALLBACKS[kind];
      const selector =
        kind === "dark"
          ? `:root, body.vscode-dark, .vscode-dark`
          : `body.${webviewThemeClass(kind)}, .${webviewThemeClass(kind)}`;
      return `${selector} {
  --background: var(--vscode-editor-background, ${palette.editorBackground});
  --foreground: var(--vscode-editor-foreground, ${palette.editorForeground});
  --nx-chrome-bg: var(--vscode-sideBar-background, ${palette.sidebarBackground});
  --nx-chrome-fg: var(--vscode-editor-foreground, ${palette.editorForeground});
  --nx-status-added: var(--vscode-gitDecoration-addedResourceForeground, ${palette.added});
  --nx-status-modified: var(--vscode-gitDecoration-modifiedResourceForeground, ${palette.modified});
  --nx-status-deleted: var(--vscode-gitDecoration-deletedResourceForeground, ${palette.deleted});
  --nx-status-untracked: var(--vscode-gitDecoration-untrackedResourceForeground, ${palette.untracked});
  --nx-status-ignored: var(--vscode-gitDecoration-ignoredResourceForeground, ${palette.ignored});
  --nx-status-conflict: var(--vscode-gitDecoration-conflictingResourceForeground, ${palette.conflicted});
  --nx-status-renamed: var(--vscode-gitDecoration-renamedResourceForeground, var(--vscode-gitDecoration-modifiedResourceForeground, ${palette.renamed}));
}`;
    })
    .join("\n");
}

const STYLE_ID = "nx-webview-theme-fallbacks";

export function ensureWebviewThemeStyle(
  root: ParentNode = typeof document === "undefined" ? (null as never) : document.head,
): HTMLStyleElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const existing = document.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) {
    existing.textContent = webviewThemeFallbackCss();
    return existing;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = webviewThemeFallbackCss();
  root.appendChild(style);
  return style;
}

const VAR_REF =
  /^var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^)(]+|\([^)(]*\))*))?\s*\)$/;

/** Resolve a custom property the way a browser does: host --vscode-* first. */
export function resolveThemeColor(el: Element, property: string): string {
  return resolveVarChain(
    el,
    getComputedStyle(el).getPropertyValue(property).trim(),
    new Set(),
  );
}

function resolveVarChain(
  el: Element,
  raw: string,
  seen: Set<string>,
): string {
  if (!raw) {
    return "";
  }
  const match = raw.match(VAR_REF);
  if (!match) {
    return raw;
  }
  const token = match[1]!;
  const fallback = (match[2] ?? "").trim();
  if (seen.has(token)) {
    return fallback;
  }
  seen.add(token);
  const host = getComputedStyle(el).getPropertyValue(token).trim();
  if (host) {
    return resolveVarChain(el, host, seen);
  }
  return resolveVarChain(el, fallback, seen);
}

export function readChromeThemeVars(el: Element): {
  background: string;
  foreground: string;
  added: string;
  modified: string;
  deleted: string;
  untracked: string;
  conflict: string;
} {
  return {
    background: resolveThemeColor(el, "--nx-chrome-bg")
      || resolveThemeColor(el, "--background"),
    foreground: resolveThemeColor(el, "--nx-chrome-fg")
      || resolveThemeColor(el, "--foreground"),
    added: resolveThemeColor(el, "--nx-status-added"),
    modified: resolveThemeColor(el, "--nx-status-modified"),
    deleted: resolveThemeColor(el, "--nx-status-deleted"),
    untracked: resolveThemeColor(el, "--nx-status-untracked"),
    conflict: resolveThemeColor(el, "--nx-status-conflict"),
  };
}

const PLAYGROUND_VSCODE_VARS: Record<
  keyof WebviewThemeFallbackPalette,
  string
> = {
  editorBackground: "--vscode-editor-background",
  editorForeground: "--vscode-editor-foreground",
  sidebarBackground: "--vscode-sideBar-background",
  description: "--vscode-descriptionForeground",
  added: "--vscode-gitDecoration-addedResourceForeground",
  modified: "--vscode-gitDecoration-modifiedResourceForeground",
  deleted: "--vscode-gitDecoration-deletedResourceForeground",
  untracked: "--vscode-gitDecoration-untrackedResourceForeground",
  ignored: "--vscode-gitDecoration-ignoredResourceForeground",
  conflicted: "--vscode-gitDecoration-conflictingResourceForeground",
  renamed: "--vscode-gitDecoration-renamedResourceForeground",
};

function hostAlreadyDefines(target: HTMLElement, cssVar: string): boolean {
  if (target.style.getPropertyValue(cssVar).trim()) {
    return true;
  }
  return Boolean(getComputedStyle(target).getPropertyValue(cssVar).trim());
}

/** Preview-only: fill missing --vscode-* vars so Vite playground restyles. */
export function applyPlaygroundThemeVars(
  target: HTMLElement,
  kind: ThemeKind,
): void {
  const palette = WEBVIEW_THEME_FALLBACKS[kind];
  for (const [key, cssVar] of Object.entries(PLAYGROUND_VSCODE_VARS) as [
    keyof WebviewThemeFallbackPalette,
    string,
  ][]) {
    if (hostAlreadyDefines(target, cssVar)) {
      continue;
    }
    target.style.setProperty(cssVar, palette[key]);
  }
  const extras: Array<[string, string]> = [
    ["--vscode-focusBorder", kind === "light" || kind === "high-contrast-light" ? "#005fb8" : "#007fd4"],
    ["--vscode-list-activeSelectionBackground", kind === "light" || kind === "high-contrast-light" ? "#0060c0" : "#094771"],
    ["--vscode-list-activeSelectionForeground", "#ffffff"],
    ["--vscode-list-hoverBackground", kind === "light" || kind === "high-contrast-light" ? "#f3f3f3" : "rgba(255,255,255,0.08)"],
    ["--vscode-input-background", kind === "light" || kind === "high-contrast-light" ? "#ffffff" : "#3c3c3c"],
    ["--vscode-input-foreground", palette.editorForeground],
    ["--vscode-button-background", kind === "light" || kind === "high-contrast-light" ? "#0078d4" : "#0e639c"],
    ["--vscode-button-foreground", "#ffffff"],
    ["--vscode-button-secondaryBackground", kind === "light" || kind === "high-contrast-light" ? "#e5e5e5" : "#3a3d41"],
    ["--vscode-button-secondaryForeground", palette.editorForeground],
    ["--vscode-panel-border", kind === "light" || kind === "high-contrast-light" ? "#e5e5e5" : "#3c3c3c"],
  ];
  for (const [cssVar, value] of extras) {
    if (!hostAlreadyDefines(target, cssVar)) {
      target.style.setProperty(cssVar, value);
    }
  }
}

export function applyWebviewTheme(
  kind: ThemeKind,
  options: { playgroundVars?: boolean } = {},
): void {
  if (typeof document === "undefined") {
    return;
  }
  ensureWebviewThemeStyle();
  applyWebviewThemeClass(document.body, kind);
  applyWebviewThemeClass(document.documentElement, kind);
  if (options.playgroundVars) {
    applyPlaygroundThemeVars(document.documentElement, kind);
  }
}
