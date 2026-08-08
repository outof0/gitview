import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

const forbiddenTrademarkTerms = [
  ["Intel", "liJ"].join(""),
  ["Jet", "Brains"].join(""),
  String.fromCharCode(73, 68, 69, 65),
];

const FORBIDDEN_UI_PATTERNS = forbiddenTrademarkTerms.map(
  (term) => new RegExp(`\\b${term}\\b`, "i"),
);

function readFilesRecursively(dir: string, ext: string[]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      files.push(...readFilesRecursively(full, ext));
      continue;
    }
    if (ext.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(full);
    }
  }
  return files;
}

describe("copy ownership", () => {
  it("git UI components do not include vendor trademark strings", () => {
    const gitComponentsDir = path.join(ROOT, "webview/src/components/git");
    const files = readFilesRecursively(gitComponentsDir, [".tsx", ".ts"]);
    const violations: string[] = [];

    for (const file of files) {
      if (file.includes("__tests__")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_UI_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(ROOT, file)}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("product-exception registry records copy ownership policy", () => {
    const docPath = path.join(ROOT, "docs/maintainers/exceptions.md");
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, "utf8");
    expect(content).toMatch(/Copy ownership/i);
    expect(content).toMatch(/GitView-owned/i);
  });
});
