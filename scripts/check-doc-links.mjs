#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const documentationRoots = [
  "README.md",
  "CONTRIBUTING.md",
  "RELEASE.md",
  "CHANGELOG.md",
  "docs",
  ".github",
];
const ignoredSchemes = /^(?:https?:|mailto:|data:|vscode:|command:)/i;

function collectMarkdownFiles(target) {
  const absolutePath = path.join(root, target);
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    return absolutePath.endsWith(".md") ? [absolutePath] : [];
  }
  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(target, entry.name);
      return entry.isDirectory()
        ? collectMarkdownFiles(child)
        : entry.isFile() && entry.name.endsWith(".md")
          ? [path.join(root, child)]
          : [];
    });
}

function repoPath(absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

const markdownFiles = documentationRoots.flatMap(collectMarkdownFiles);
const failures = [];
let checkedLinks = 0;

for (const markdownFile of markdownFiles) {
  const source = fs
    .readFileSync(markdownFile, "utf8")
    .replace(/```[\s\S]*?```/g, "");
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.split(/\s+["']/)[0];
    if (!target || target.startsWith("#") || ignoredSchemes.test(target)) {
      continue;
    }
    const localTarget = target.split("#", 1)[0].split("?", 1)[0];
    let decodedTarget;
    try {
      decodedTarget = decodeURIComponent(localTarget);
    } catch {
      failures.push(
        `${repoPath(markdownFile)} contains an invalid encoded link: ${target}`,
      );
      continue;
    }
    const resolved = decodedTarget.startsWith("/")
      ? path.join(root, decodedTarget.slice(1))
      : path.resolve(path.dirname(markdownFile), decodedTarget);
    checkedLinks++;
    if (!fs.existsSync(resolved)) {
      failures.push(
        `${repoPath(markdownFile)} links to missing path: ${target}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation link check failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Documentation links OK (${markdownFiles.length} Markdown files, ${checkedLinks} local links).`,
);
