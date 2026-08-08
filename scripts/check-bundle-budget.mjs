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
  monacoSetup: 4000,
  totalDist: 5500,
};

function kb(filePath) {
  return fs.statSync(filePath).size / 1024;
}

function findAsset(prefix) {
  const files = fs.readdirSync(dist);
  const match = files.find((f) => f.startsWith(prefix) && f.endsWith(".js"));
  if (!match) {
    return null;
  }
  return path.join(dist, match);
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

const indexPath = findAsset("index");
const monacoPath = findAsset("monacoSetup");
const indexKb = indexPath ? kb(indexPath) : 0;
const monacoKb = monacoPath ? kb(monacoPath) : 0;
const totalKb = totalDistKb();

const failures = [];
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
if (totalKb > BUDGETS_KB.totalDist) {
  failures.push(
    `webview/dist/assets total ${totalKb.toFixed(0)} kB > ${BUDGETS_KB.totalDist} kB`,
  );
}

console.log(
  `Bundle: index=${indexKb.toFixed(0)} kB, monaco=${monacoKb.toFixed(0)} kB, total=${totalKb.toFixed(0)} kB`,
);

if (failures.length > 0) {
  console.error("Bundle budget exceeded:");
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("Bundle budget OK.");