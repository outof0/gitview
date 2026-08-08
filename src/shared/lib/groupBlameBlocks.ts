export type BlameBlockLine = {
  lineNumber: number;
  sha: string;
  shortSha: string;
  author: string;
  authorTime: number;
  summary: string;
  text?: string;
};

export type BlameBlock<T extends BlameBlockLine = BlameBlockLine> = {
  sha: string;
  lines: T[];
  anchor: T;
};

/** Group consecutive blame lines by commit SHA (compact annotation blocks). */
export function groupBlameBlocks<T extends BlameBlockLine>(
  lines: T[],
): BlameBlock<T>[] {
  const blocks: BlameBlock<T>[] = [];
  for (const line of lines) {
    const tail = blocks[blocks.length - 1];
    if (tail && tail.sha === line.sha) {
      tail.lines.push(line);
    } else {
      blocks.push({ sha: line.sha, lines: [line], anchor: line });
    }
  }
  return blocks;
}

export function countBlameAnnotations(lines: BlameBlockLine[]): number {
  return groupBlameBlocks(lines).length;
}