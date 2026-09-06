/**
 * Contract tests for the webview theme adapter.
 *
 * `check-ui-system.mjs` keeps components from reaching past the design system,
 * but it cannot see the other half of the contract: a Tailwind alias that
 * points at a token `tokens.css` never declares. That failure is silent — the
 * utility compiles, the class ships, and the element simply renders unstyled.
 * These tests close that gap.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tailwindConfigPath = join(root, "webview", "tailwind.config.js");
const tokensPath = join(root, "webview", "src", "styles", "tokens.css");
const webviewSrc = join(root, "webview", "src");

/** `var(--nx-foo)` references inside a string value. */
function referencedTokens(value) {
  return [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]);
}

/** Every string leaf of the Tailwind theme, wherever it sits. */
function themeValues(node, out = []) {
  if (typeof node === "string") {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const child of node) {
      themeValues(child, out);
    }
  } else if (node && typeof node === "object") {
    for (const child of Object.values(node)) {
      themeValues(child, out);
    }
  }
  return out;
}

/** Custom properties declared inside a given selector block. */
function declaredTokens(css, selector) {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector} missing from tokens.css`).toBeGreaterThan(
    -1,
  );
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") {
      depth += 1;
    } else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  return [...body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Duplicated declarations inside a block, reported once each. */
function findDuplicates(names) {
  const counts = new Map();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

describe("theme adapter contract", () => {
  const css = readFileSync(tokensPath, "utf8");
  const rootTokens = new Set(declaredTokens(css, ":root"));

  it("declares every token referenced by the Tailwind theme", async () => {
    const config = (await import(tailwindConfigPath)).default;
    const refs = new Set(themeValues(config.theme).flatMap(referencedTokens));

    expect(refs.size).toBeGreaterThan(50);
    const undeclared = [...refs].filter(
      (token) => token.startsWith("--nx-") && !rootTokens.has(token),
    );
    expect(undeclared).toEqual([]);
  });

  it("routes theme values through tokens, never straight to VS Code", async () => {
    const config = (await import(tailwindConfigPath)).default;
    const vscodeRefs = themeValues(config.theme).flatMap((value) =>
      [...value.matchAll(/var\(\s*--vscode-[^,)]+/gi)].map((m) => m[0]),
    );

    // tokens.css is the one place allowed to name a VS Code variable; the
    // Tailwind theme is a consumer of tokens and nothing else.
    expect(vscodeRefs).toEqual([]);
  });

  it("declares each custom property exactly once", () => {
    expect(findDuplicates(declaredTokens(css, ":root"))).toEqual([]);
  });

  it("covers every --nx-* token referenced from webview source", () => {
    const referenced = new Set();
    for (const file of walk(webviewSrc)) {
      for (const token of referencedTokens(readFileSync(file, "utf8"))) {
        referenced.add(token);
      }
    }

    const missing = [...referenced].filter(
      (token) => token.startsWith("--nx-") && !rootTokens.has(token),
    );
    expect(missing).toEqual([]);
  });

  it("keeps the file-type palette inside the token set", () => {
    const glyphSource = readFileSync(
      join(webviewSrc, "components", "ui", "FileTypeGlyph.tsx"),
      "utf8",
    );
    const suffixes = [
      ...glyphSource.matchAll(/"(?:bg|text|fill)-lang-([a-z-]+)"/g),
    ].map((m) => m[1]);

    expect(suffixes.length).toBeGreaterThan(0);
    for (const suffix of suffixes) {
      const token = `--nx-lang-${suffix}`;
      expect(rootTokens.has(token), token).toBe(true);
    }
  });
});
