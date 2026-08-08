/** Compact annotate date: D/M/YY (e.g. 24/6/22) */
export function formatBlameAnnotationDate(authorTimeSec: number): string {
  const d = new Date(authorTimeSec * 1000);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${yy}`;
}

/**
 * Accent color per commit — used as a thin left stripe on the annotate
 * column only (not a full cell fill), so source code stays clean.
 */
export function blameBlockBackground(sha: string): string {
  let hash = 0;
  for (let i = 0; i < sha.length; i += 1) {
    hash = (hash * 31 + sha.charCodeAt(i)) >>> 0;
  }
  const palette = [
    "#5b8def",
    "#6a9bd6",
    "#7a8a9a",
    "#4f7ec4",
    "#8b95a1",
  ];
  return palette[hash % palette.length]!;
}

export function isCurrentRevisionLine(
  lineSha: string,
  headSha: string | null | undefined,
): boolean {
  if (!headSha) {
    return false;
  }
  return (
    lineSha === headSha ||
    lineSha.startsWith(headSha) ||
    headSha.startsWith(lineSha)
  );
}

/** compact blame label on every line: "24/6/22 Author commit message *" */
export function formatBlameAnnotationLabel(
  line: {
    author: string;
    authorTime: number;
    sha: string;
    summary: string;
  },
  headSha?: string | null,
): string {
  const date = formatBlameAnnotationDate(line.authorTime);
  const current = isCurrentRevisionLine(line.sha, headSha);
  const marker = current ? " *" : "";
  const summary = line.summary.trim();
  return summary
    ? `${date} ${line.author} ${summary}${marker}`
    : `${date} ${line.author}${marker}`;
}
