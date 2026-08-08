/**
 * Remove Git merge conflict marker lines from text so compare/diff previews
 * show real source code — not VS Code-style "<<<<<<< Incoming" chrome.
 *
 * Keeps both sides' code (ours + theirs); only drops the marker lines themselves:
 *   <<<<<<< …, =======, >>>>>>> …
 */
export function stripGitConflictMarkers(text: string): string {
  if (!text.includes("<<<<<<<") && !text.includes(">>>>>>>")) {
    return text;
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (
      line.startsWith("<<<<<<<") ||
      line.startsWith(">>>>>>>") ||
      line.startsWith("=======")
    ) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** True when text still contains conflict marker lines. */
export function hasGitConflictMarkers(text: string): boolean {
  return /^(<<<<<<<|=======|>>>>>>>)/m.test(text);
}
