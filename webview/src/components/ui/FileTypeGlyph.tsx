/**
 * File-type glyph palette.
 *
 * Two surfaces render the same glyph set (the changed-files tree and the
 * conflicts table). The extension-to-colour mapping lives here once so the
 * two cannot drift, and the brand colours are read through `lang-*` tokens
 * declared in `styles/tokens.css` rather than repeated as hex literals.
 */

export type FileTypeGlyph = {
  /** Text shown inside the badge. */
  label: string;
  /** Background utility from the `lang` palette. */
  bg: string;
  /** Foreground utility chosen for contrast against `bg`. */
  ink: string;
};

const GLYPHS: ReadonlyArray<{
  extensions: readonly string[];
  glyph: FileTypeGlyph;
}> = [
  // Order matters: the more specific suffix must be tested first.
  {
    extensions: [".tsx"],
    glyph: { label: "TS", bg: "bg-lang-tsx", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".ts"],
    glyph: { label: "TS", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".jsx"],
    glyph: { label: "JSX", bg: "bg-lang-jsx", ink: "text-lang-jsx-ink" },
  },
  {
    extensions: [".js", ".mjs", ".cjs"],
    glyph: { label: "JS", bg: "bg-lang-js", ink: "text-lang-on-light" },
  },
  {
    extensions: [".json", ".jsonc"],
    glyph: { label: "{}", bg: "bg-lang-json", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".css", ".scss", ".less"],
    glyph: { label: "#", bg: "bg-lang-css", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".html", ".htm"],
    glyph: { label: "<>", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".vue"],
    glyph: { label: "VUE", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".svelte"],
    glyph: { label: "SVE", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".astro"],
    glyph: { label: "AST", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".xml"],
    glyph: { label: "XML", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".mdx"],
    glyph: { label: "MDX", bg: "bg-lang-md", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".pug", ".jade"],
    glyph: { label: "PUG", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".hbs", ".handlebars", ".mustache"],
    glyph: { label: "HBS", bg: "bg-lang-html", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".graphql", ".gql"],
    glyph: { label: "GQL", bg: "bg-lang-jsx", ink: "text-lang-jsx-ink" },
  },
  {
    extensions: [".proto"],
    glyph: { label: "PB", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".sql"],
    glyph: { label: "SQL", bg: "bg-lang-css", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".toml", ".ini", ".env"],
    glyph: { label: "CFG", bg: "bg-lang-yaml", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".sh", ".bash", ".zsh", ".fish"],
    glyph: { label: "SH", bg: "bg-lang-json", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".ps1", ".psm1"],
    glyph: { label: "PS", bg: "bg-lang-js", ink: "text-lang-on-light" },
  },
  {
    extensions: [".bat", ".cmd"],
    glyph: { label: "BAT", bg: "bg-lang-js", ink: "text-lang-on-light" },
  },
  {
    extensions: [".rs"],
    glyph: { label: "RS", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".go"],
    glyph: { label: "GO", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".java"],
    glyph: { label: "JV", bg: "bg-lang-js", ink: "text-lang-on-light" },
  },
  {
    extensions: [".kt", ".kts"],
    glyph: { label: "KT", bg: "bg-lang-js", ink: "text-lang-on-light" },
  },
  {
    extensions: [".swift"],
    glyph: { label: "SW", bg: "bg-lang-js", ink: "text-lang-on-light" },
  },
  {
    extensions: [".dart"],
    glyph: { label: "DA", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".php"],
    glyph: { label: "PHP", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".rb"],
    glyph: { label: "RB", bg: "bg-lang-jsx", ink: "text-lang-jsx-ink" },
  },
  {
    extensions: [".cs"],
    glyph: { label: "C#", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".c", ".h", ".cpp", ".cc", ".cxx", ".hpp"],
    glyph: { label: "C++", bg: "bg-lang-ts", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".py"],
    glyph: { label: "py", bg: "bg-lang-py", ink: "text-lang-on-dark" },
  },
  {
    extensions: [".yml", ".yaml"],
    glyph: { label: "Y", bg: "bg-lang-yaml", ink: "text-lang-on-dark" },
  },
];

/**
 * Resolve the badge glyph for a filename, or `null` when the type has no
 * badge (markdown, images and the generic file fall back to an SVG glyph).
 */
export function fileTypeGlyph(fileName: string): FileTypeGlyph | null {
  const name = fileName.toLowerCase();
  const basename = name.split("/").pop() ?? name;
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) {
    return { label: "DOC", bg: "bg-lang-html", ink: "text-lang-on-dark" };
  }
  if (basename === "makefile" || basename === "gnumakefile") {
    return { label: "MK", bg: "bg-lang-css", ink: "text-lang-on-dark" };
  }
  if (basename === ".gitignore" || basename === ".gitattributes") {
    return { label: "GIT", bg: "bg-lang-json", ink: "text-lang-on-dark" };
  }
  for (const entry of GLYPHS) {
    if (entry.extensions.some((ext) => name.endsWith(ext))) {
      return entry.glyph;
    }
  }
  return null;
}

/** Utility class for the SVG glyph variants, kept beside the palette. */
export const FILE_TYPE_GLYPH_FILL = {
  markdown: "fill-lang-md",
  image: "fill-lang-image",
} as const;
