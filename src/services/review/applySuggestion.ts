import * as fs from "fs/promises";
import { resolveRepoRelativePath } from "../../util/repoPath";

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
  const resolved = resolveRepoRelativePath(repoRoot, relativePath);
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
  await fs.writeFile(
    resolved.absolutePath,
    next.endsWith("\n") ? next : `${next}\n`,
  );
}