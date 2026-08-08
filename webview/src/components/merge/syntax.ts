// Lightweight regex tokenizer for code panes. Supports a broad set of
// languages (TypeScript/JavaScript, Python, Rust, Go, CSS/SCSS, JSON, YAML,
// Markdown, Shell, C/C++, Java, PHP, Ruby, Swift, Kotlin, Dart, SQL…).
// Pure and functional: returns tokens that the renderer maps to <span>
// elements — no dangerouslySetInnerHTML / manual HTML escaping needed.

import { tokenizeLine } from "./syntaxTokenizer";

export type { SyntaxToken, SyntaxTokenType } from "./syntaxTypes";
export { tokenizeLine };

// ── CSS class mapper ─────────────────────────────────────────────────────────

export function syntaxClass(type: import("./syntaxTypes").SyntaxTokenType): string | undefined {
  switch (type) {
    case "property":
      return "syntax-property";
    case "variable":
      return "syntax-variable";
    case "keyword":
      return "syntax-keyword";
    case "keyword2":
      return "syntax-keyword2";
    case "type":
      return "syntax-type";
    case "builtin":
      return "syntax-builtin";
    case "string":
      return "syntax-string";
    case "template":
      return "syntax-template";
    case "comment":
      return "syntax-comment";
    case "number":
      return "syntax-number";
    case "operator":
      return "syntax-operator";
    case "decorator":
      return "syntax-decorator";
    default:
      return undefined;
  }
}

// ── Language detection ───────────────────────────────────────────────────────
// Simple extension-based detection used by Monaco to set the language mode.
export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const MAP: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    pyw: "python",
    rs: "rust",
    go: "go",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    mdx: "markdown",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    swift: "swift",
    dart: "dart",
    php: "php",
    rb: "ruby",
    cs: "csharp",
    sql: "sql",
    xml: "xml",
    toml: "toml",
    ini: "ini",
    dockerfile: "dockerfile",
  };
  // Special filename matches
  const basename = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  if (basename === "makefile" || basename === "gnumakefile") {
    return "makefile";
  }
  return MAP[ext] ?? "plaintext";
}