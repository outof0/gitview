#!/usr/bin/env node
/**
 * Release lineage gate.
 *
 * Changelogen resolves the changelog range from local Git refs. A local tag
 * can be stale, unpublished, or moved, so the shared gate first resolves the
 * newest published tag from the release remote and compares its object with
 * the local checkout. A mismatch must fail before changelogen can invent a
 * plausible but false changelog heading.
 *
 * This gate fails before that can happen, and prints the range changelogen
 * will use so a human can eyeball it.
 */
import fs from "node:fs";
import path from "node:path";
import { getPublishedReleaseLineage, root } from "./release-lineage.mjs";

const warnings = [];

try {
  const lineage = getPublishedReleaseLineage();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (!lineage.latest) {
    warnings.push(
      "no published v* tags — the changelog will cover the entire history (expected for the first release only)",
    );
    console.log(
      `Release lineage OK: no published tags, changelog covers all of HEAD (${lineage.headSha.slice(
        0,
        7,
      )}).`,
    );
  } else {
    if (`v${pkg.version}` === lineage.latest.name) {
      warnings.push(
        `package.json version ${pkg.version} already matches tag ${lineage.latest.name} — the changelog range is empty until you bump the version`,
      );
    }
    console.log(
      `Release lineage OK: ${lineage.latest.name} (${lineage.latest.commitSha.slice(
        0,
        7,
      )}) is an ancestor of HEAD (${lineage.headSha.slice(0, 7)}).`,
    );
    console.log(`Changelog range: ${lineage.latest.name}..HEAD`);
  }
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
} catch (error) {
  console.error("Release lineage is broken — refusing to generate a changelog:");
  console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error(
    "Do not move or force-push an existing published tag to repair this history.",
  );
  console.error(
    "Restore the tagged commit as an ancestor of this branch, or cut a new version/tag from this HEAD.",
  );
  process.exitCode = 1;
}
