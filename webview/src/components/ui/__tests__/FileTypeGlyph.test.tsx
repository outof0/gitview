// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FILE_TYPE_GLYPH_FILL,
  fileTypeGlyph,
} from "../FileTypeGlyph";
import { GitFileIcon } from "../../git/gitFileIcon";
import { getFileIcon } from "../../conflict-list/conflictsDialog/conflictsDialogUtils";

/** Every extension the palette claims to know, in declaration order. */
const KNOWN = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".htm",
  ".vue",
  ".svelte",
  ".astro",
  ".xml",
  ".mdx",
  ".graphql",
  ".proto",
  ".sql",
  ".toml",
  ".sh",
  ".ps1",
  ".rs",
  ".go",
  ".java",
  ".swift",
  ".php",
  ".rb",
  ".cs",
  ".cpp",
  ".py",
  ".yml",
  ".yaml",
] as const;

const HEX = /#[0-9a-fA-F]{3,8}\b/;

describe("fileTypeGlyph", () => {
  it("resolves a badge for every declared extension", () => {
    for (const ext of KNOWN) {
      const glyph = fileTypeGlyph(`package${ext}`);
      expect(glyph, ext).not.toBeNull();
      expect(glyph!.bg, ext).toMatch(/^bg-lang-/);
    }
  });

  it("prefers the more specific suffix over the shorter one", () => {
    // ".tsx" must not fall through to the ".ts" entry, and likewise for JSX.
    expect(fileTypeGlyph("App.tsx")?.bg).toBe("bg-lang-tsx");
    expect(fileTypeGlyph("App.ts")?.bg).toBe("bg-lang-ts");
    expect(fileTypeGlyph("App.jsx")?.bg).toBe("bg-lang-jsx");
    expect(fileTypeGlyph("App.js")?.bg).toBe("bg-lang-js");
  });

  it("matches extensions case-insensitively", () => {
    expect(fileTypeGlyph("README.MD")).toBeNull();
    expect(fileTypeGlyph("Dockerfile.YML")).toEqual(
      fileTypeGlyph("dockerfile.yml"),
    );
    expect(fileTypeGlyph("App.TSX")?.bg).toBe("bg-lang-tsx");
  });

  it("returns null for types drawn as SVG glyphs", () => {
    for (const name of [
      "README.md",
      "logo.png",
      "photo.jpg",
      "clip.gif",
      "icon.svg",
      "hero.webp",
    ]) {
      expect(fileTypeGlyph(name), name).toBeNull();
    }
  });

  it("only ever references token-backed utility classes", () => {
    const classes = [
      ...KNOWN.map((ext) => fileTypeGlyph(`a${ext}`)!.bg),
      ...KNOWN.map((ext) => fileTypeGlyph(`a${ext}`)!.ink),
      ...Object.values(FILE_TYPE_GLYPH_FILL),
    ];
    for (const cls of classes) {
      expect(cls, cls).not.toMatch(HEX);
      expect(/^(bg|text|fill)-lang-/.test(cls), cls).toBe(true);
    }
  });
});

describe("file-type glyph consumers", () => {
  afterEach(() => cleanup());

  it("renders the same palette in the files tree and the conflicts table", () => {
    // The two surfaces used to carry independent copies of this palette; they
    // must not be allowed to drift apart again.
    for (const fileName of ["a.tsx", "b.js", "c.json", "d.yml", "e.css"]) {
      const glyph = fileTypeGlyph(fileName)!;
      const tree = render(<GitFileIcon fileName={fileName} />);
      const treeClass = tree.container.firstElementChild!.className;
      cleanup();
      const table = render(<>{getFileIcon(fileName)}</>);
      const tableClass = table.container.firstElementChild!.className;
      cleanup();

      expect(treeClass).toContain(glyph.bg);
      expect(treeClass).toContain(glyph.ink);
      expect(tableClass).toContain(glyph.bg);
      expect(tableClass).toContain(glyph.ink);
    }
  });

  it("draws markdown and images from the palette, not from hex literals", () => {
    // SVG elements expose `className` as an SVGAnimatedString, not a string.
    const classOf = (container: HTMLElement) =>
      container.querySelector("svg")!.getAttribute("class") ?? "";

    const md = render(<GitFileIcon fileName="README.md" />);
    expect(classOf(md.container)).toContain(FILE_TYPE_GLYPH_FILL.markdown);
    expect(md.container.innerHTML).not.toMatch(HEX);
    cleanup();

    const png = render(<GitFileIcon fileName="logo.png" />);
    expect(classOf(png.container)).toContain(FILE_TYPE_GLYPH_FILL.image);
    expect(png.container.innerHTML).not.toMatch(HEX);
    cleanup();

    const makefile = render(<GitFileIcon fileName="Makefile" />);
    expect(makefile.container.textContent).toContain("MK");
    expect(makefile.container.innerHTML).not.toMatch(HEX);
  });

  it("covers framework files and repository metadata with recognizable labels", () => {
    expect(fileTypeGlyph("App.vue")?.label).toBe("VUE");
    expect(fileTypeGlyph("main.rs")?.label).toBe("RS");
    expect(fileTypeGlyph("schema.graphql")?.label).toBe("GQL");
    expect(fileTypeGlyph(".gitignore")?.label).toBe("GIT");
    expect(fileTypeGlyph("Dockerfile")?.label).toBe("DOC");
  });

  it("exposes the glyph as decorative content, not as a control", () => {
    render(<GitFileIcon fileName="index.ts" />);
    const glyph = screen.getByText("TS");
    expect(glyph.tagName).toBe("SPAN");
    expect(glyph.getAttribute("role")).toBeNull();
    expect(glyph.getAttribute("tabindex")).toBeNull();
  });
});
