#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}

const packagedFiles = new Set(
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);
const failures = [];

for (const required of [
  "out/extension.js",
  "out/extension.d.ts",
  "out/publicApi.d.ts",
]) {
  if (!packagedFiles.has(required)) {
    failures.push(`missing public declaration: ${required}`);
  }
}

const forbidden = [
  /(^|\/)__tests__\//,
  /^out\/test\//,
  /^test-(?:clean|conflict)-repo\//,
  /\.d\.ts\.map$/,
  /^out\/gitViewContextRef\./,
  /^out\/util\/silentVsCodeApp\./,
  /^out\/(?!extension\.js$).*\.js$/,
];
for (const file of packagedFiles) {
  if (forbidden.some((pattern) => pattern.test(file))) {
    failures.push(`test, stale, or source-map artifact packaged: ${file}`);
  }
}

function resolveDeclaration(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), specifier),
  );
  for (const candidate of [`${base}.d.ts`, `${base}/index.d.ts`]) {
    if (fs.existsSync(path.join(root, candidate))) {
      return candidate;
    }
  }
  return null;
}

const pending = ["out/extension.d.ts"];
const visited = new Set();
const importPattern = /(?:from\s+|import\s*\()["']([^"']+)["']/g;
while (pending.length > 0) {
  const file = pending.pop();
  if (!file || visited.has(file)) {
    continue;
  }
  visited.add(file);
  if (!packagedFiles.has(file)) {
    failures.push(`public declaration dependency is not packaged: ${file}`);
    continue;
  }
  const source = fs.readFileSync(path.join(root, file), "utf8");
  importPattern.lastIndex = 0;
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveDeclaration(file, match[1]);
    if (dependency && !visited.has(dependency)) {
      pending.push(dependency);
    }
  }
}

if (failures.length > 0) {
  console.error("Package content check failed:");
  for (const failure of new Set(failures)) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Package contents OK (${packagedFiles.size} files, ${visited.size} public declarations).`,
);
