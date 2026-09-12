#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webviewRoot = path.join(root, "webview/src");
const baselinePath = path.join(
  root,
  "docs/maintainers/ui-system-baseline.json",
);

export const UI_SYSTEM_RULES = {
  "raw-interactive": {
    pattern: /<(?:button|input|select|textarea)\b/g,
    allow: (file) => file.startsWith("webview/src/components/ui/"),
    message: "use a component from components/ui",
  },
  "unstyled-button-variant": {
    pattern: /variant=["']unstyled["']/g,
    allow: () => false,
    message: "classify the Button as primary, secondary, danger, ghost, or toolbar",
  },
  "direct-vscode-token": {
    pattern: /var\(--vscode-[^) ,]+/g,
    allow: () => false,
    message: "map the VS Code value once in styles/tokens.css",
  },
  "literal-color": {
    pattern:
      /#[\da-f]{3,8}\b|rgba?\(|\b(?:bg|text|border|ring|fill|stroke)-(?:black|white|red|green|blue|yellow|orange|gray|slate|zinc|neutral|stone)(?:-\d{2,3})?(?:\/\d+)?\b/gi,
    allow: () => false,
    message: "use a semantic token instead of a component-local color",
  },
  "literal-pixel-class": {
    pattern: /\[\d+(?:\.\d+)?px\]/g,
    allow: () => false,
    message: "use a density, spacing, or geometry token",
  },
  "non-system-radius": {
    pattern:
      /(?<![\w-])rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|\[[\d.]+px\]))?(?![\w-])/g,
    allow: () => false,
    message: "use rounded-vscode or rounded-full",
  },
  "ad-hoc-horizontal-scroll": {
    pattern: /\boverflow-(?:auto|x-auto|x-scroll)\b/g,
    allow: (file) => file === "webview/src/components/ui/ScrollArea.tsx",
    message: "make ScrollArea the explicit scroll owner",
  },
};

function collectFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "dev") {
        continue;
      }
      files.push(...collectFiles(absolute));
      continue;
    }
    if (
      entry.isFile() &&
      entry.name.endsWith(".tsx") &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      files.push(absolute);
    }
  }
  return files;
}

export function auditUiText(file, source) {
  const findings = [];
  for (const [rule, config] of Object.entries(UI_SYSTEM_RULES)) {
    if (config.allow(file)) {
      continue;
    }
    for (const match of source.matchAll(config.pattern)) {
      const index = match.index ?? 0;
      const line = source.slice(0, index).split("\n").length;
      findings.push({
        rule,
        file,
        line,
        value: match[0],
        message: config.message,
      });
    }
  }
  return findings;
}

export function summarizeUiFindings(findings) {
  const counts = Object.fromEntries(
    Object.keys(UI_SYSTEM_RULES).map((rule) => [rule, 0]),
  );
  for (const finding of findings) {
    counts[finding.rule] += 1;
  }
  return counts;
}

export function auditUiFiles(files) {
  return files.flatMap((absolute) => {
    const file = path.relative(root, absolute).split(path.sep).join("/");
    return auditUiText(file, fs.readFileSync(absolute, "utf8"));
  });
}

function baselineDocument(counts) {
  return { version: 1, rules: counts };
}

function printReport(counts) {
  const width = Math.max(...Object.keys(counts).map((rule) => rule.length));
  for (const [rule, count] of Object.entries(counts)) {
    process.stdout.write(
      `${rule.padEnd(width)}  ${String(count).padStart(4)}\n`,
    );
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const findings = auditUiFiles(collectFiles(webviewRoot));
  const counts = summarizeUiFindings(findings);

  if (args.has("--print-baseline")) {
    process.stdout.write(
      `${JSON.stringify(baselineDocument(counts), null, 2)}\n`,
    );
    return;
  }

  if (!fs.existsSync(baselinePath)) {
    process.stderr.write(
      "Missing docs/maintainers/ui-system-baseline.json. Run with --print-baseline and review the result.\n",
    );
    process.exitCode = 1;
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const mismatches = [];
  for (const rule of Object.keys(UI_SYSTEM_RULES)) {
    const expected = baseline.rules?.[rule];
    const actual = counts[rule];
    if (!Number.isInteger(expected) || expected < 0) {
      mismatches.push(`${rule}: baseline is missing or invalid`);
    } else if (actual > expected) {
      mismatches.push(`${rule}: ${actual} exceeds the ratchet ${expected}`);
    } else if (actual < expected) {
      mismatches.push(
        `${rule}: debt fell from ${expected} to ${actual}; lower the baseline in the same change`,
      );
    }
  }

  printReport(counts);
  if (mismatches.length > 0) {
    process.stderr.write(
      `\nUI system gate failed:\n- ${mismatches.join("\n- ")}\n`,
    );
    const samples = findings
      .filter((finding) =>
        mismatches.some((mismatch) => mismatch.startsWith(`${finding.rule}:`)),
      )
      .slice(0, 12);
    if (samples.length > 0) {
      process.stderr.write("\nCurrent examples:\n");
      for (const sample of samples) {
        process.stderr.write(
          `- ${sample.file}:${sample.line} [${sample.rule}] ${sample.value}\n`,
        );
      }
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("UI system ratchet OK.\n");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
