// Line utilities: splitting/joining text while preserving EOL + final-newline
// semantics exactly. Pure functions, no I/O.

import type { Eol } from "./types";

export function detectEol(text: string): Eol {
  // First line ending wins; default to lf when none present.
  const i = text.indexOf("\n");
  if (i > 0 && text[i - 1] === "\r") {
    return "crlf";
  }
  return "lf";
}

export function eolString(eol: Eol): string {
  return eol === "crlf" ? "\r\n" : "\n";
}

export function hasFinalNewline(text: string): boolean {
  return text.length > 0 && (text.endsWith("\n") || text.endsWith("\r\n"));
}

// Split into logical lines WITHOUT trailing EOL chars. A trailing final
// newline does NOT produce a spurious empty last line; callers track
// `hasFinalNewline` separately so join can reproduce the original exactly.
export function splitLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  // If the text ended with a newline, split produced a trailing "" — drop it.
  if (
    lines.length > 0 &&
    lines[lines.length - 1] === "" &&
    normalized.endsWith("\n")
  ) {
    lines.pop();
  }
  return lines;
}

export function joinLines(
  lines: string[],
  eol: Eol,
  finalNewline: boolean,
): string {
  const sep = eolString(eol);
  if (lines.length === 0) {
    return finalNewline ? "" : "";
  }
  return lines.join(sep) + (finalNewline ? sep : "");
}
