import * as fs from "fs/promises";
import { writeBufferAtomically } from "../fileService";
import { resolveRepoRelativeRealPath } from "../../util/repoPath";

export function applySuggestionToContent(
  content: string,
  line: number,
  startLine: number | undefined,
  suggestionText: string,
): string {
  const lines = content.split(/\r?\n/);
  const endLine = Math.max(line, startLine ?? line);
  const beginLine = Math.min(line, startLine ?? line);
  const startIndex = Math.max(0, beginLine - 1);
  const deleteCount = endLine - beginLine + 1;
  const replacement = suggestionText.split(/\r?\n/);
  lines.splice(startIndex, deleteCount, ...replacement);
  return lines.join("\n");
}

export async function applySuggestionToFile(
  repoRoot: string,
  relativePath: string,
  line: number,
  startLine: number | undefined,
  suggestionText: string,
): Promise<void> {
  // A lexical containment check is not enough: a repository path can itself be
  // a symlink to an external file, which readFile/writeFile would follow.
  // Resolve symlinks first and write atomically, so a final-component swap
  // replaces the link instead of following it outside the repository.
  const resolved = await resolveRepoRelativeRealPath(repoRoot, relativePath);
  if (!resolved.ok) {
    throw new Error(resolved.message);
  }
  const content = await fs.readFile(resolved.absolutePath, "utf8");
  const next = applySuggestionToContent(
    content,
    line,
    startLine,
    suggestionText,
  );
  const text = next.endsWith("\n") ? next : `${next}\n`;
  await writeBufferAtomically(repoRoot, resolved.absolutePath, Buffer.from(text, "utf8"));
}