#!/usr/bin/env node
/**
 * Webview bundle size budget (documented in RELEASE.md).
 * Run after `pnpm run build:webview`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "webview", "dist", "assets");

const BUDGETS_KB = {
  index: 1200,
  // Monaco's editor core plus the diff-editor feature. This is the floor: the
  // standalone editor cannot be tree-shaken much below this.
  monacoSetup: 3900,
  // One chunk per grammar (`monaco-lang-<id>.js`), loaded on demand by Monaco.
  // Measured 106 kB for all 24 on 2026-08-29.
  monacoLangTotal: 250,
  // Per-grammar cap. A grammar is a Monarch tokenizer, i.e. a few kB; anything
  // larger means a full language service leaked into the chunk (TypeScript's is
  // ~9 MB of source).
  monacoLangEach: 50,
  totalDist: 5500,
};

function kb(filePath) {
  return fs.statSync(filePath).size / 1024;
}

function jsAssets() {
  return fs.readdirSync(dist).filter((f) => f.endsWith(".js"));
}

/**
 * Resolve exactly one asset by prefix. Prefix matching used to keep the first
 * directory entry and ignore the rest, which would silently report the size of
 * an arbitrary chunk — so more than one match is a failure, not a choice.
 */
function findAsset(prefix, failures) {
  const matches = jsAssets().filter((f) => f.startsWith(prefix));
  if (matches.length === 0) {
    return null;
  }
  if (matches.length > 1) {
    failures.push(`ambiguous asset prefix "${prefix}": ${matches.join(", ")}`);
    return null;
  }
  return path.join(dist, matches[0]);
}

function findAssets(prefix) {
  return jsAssets()
    .filter((f) => f.startsWith(prefix))
    .map((f) => path.join(dist, f));
}

function totalDistKb() {
  let total = 0;
  for (const file of fs.readdirSync(dist)) {
    const full = path.join(dist, file);
    if (fs.statSync(full).isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total / 1024;
}

const failures = [];

const indexPath = findAsset("index", failures);
const monacoPath = findAsset("monacoSetup", failures);
const langChunks = findAssets("monaco-lang-");
const indexKb = indexPath ? kb(indexPath) : 0;
const monacoKb = monacoPath ? kb(monacoPath) : 0;
const langKb = langChunks.reduce((sum, file) => sum + kb(file), 0);
const totalKb = totalDistKb();

if (!indexPath) {
  failures.push("missing index*.js");
} else if (indexKb > BUDGETS_KB.index) {
  failures.push(`index.js ${indexKb.toFixed(0)} kB > ${BUDGETS_KB.index} kB`);
}
if (!monacoPath) {
  failures.push("missing monacoSetup*.js");
} else if (monacoKb > BUDGETS_KB.monacoSetup) {
  failures.push(
    `monacoSetup.js ${monacoKb.toFixed(0)} kB > ${BUDGETS_KB.monacoSetup} kB`,
  );
}
if (langKb > BUDGETS_KB.monacoLangTotal) {
  failures.push(
    `monaco-lang-*.js total ${langKb.toFixed(0)} kB > ${BUDGETS_KB.monacoLangTotal} kB`,
  );
}
for (const file of langChunks) {
  const size = kb(file);
  if (size > BUDGETS_KB.monacoLangEach) {
    failures.push(
      `${path.basename(file)} ${size.toFixed(0)} kB > ${BUDGETS_KB.monacoLangEach} kB (language service leaked into a grammar chunk?)`,
    );
  }
}
if (totalKb > BUDGETS_KB.totalDist) {
  failures.push(
    `webview/dist/assets total ${totalKb.toFixed(0)} kB > ${BUDGETS_KB.totalDist} kB`,
  );
}

console.log(
  `Bundle: index=${indexKb.toFixed(0)} kB, monaco=${monacoKb.toFixed(0)} kB, grammars=${langKb.toFixed(0)} kB (${langChunks.length}), total=${totalKb.toFixed(0)} kB`,
);

if (failures.length > 0) {
  console.error("Bundle budget exceeded:");
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("Bundle budget OK.");
