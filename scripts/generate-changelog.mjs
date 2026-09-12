import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getPublishedReleaseLineage, root } from "./release-lineage.mjs";

try {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const lineage = getPublishedReleaseLineage();
  const changelogen = path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "changelogen.cmd" : "changelogen",
  );
  const args = ["-r", pkg.version];
  if (lineage.latest) {
    args.push("--from", lineage.latest.name);
  }
  if (process.argv.includes("--write")) {
    args.push("--output", "CHANGELOG.md");
  }
  execFileSync(changelogen, args, {
    cwd: root,
    stdio: "inherit",
  });
} catch (error) {
  console.error(
    `Changelog generation refused: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
