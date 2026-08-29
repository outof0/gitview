/**
 * Pure parsing of unified-diff patch text (as stored for shelves and patches).
 * Splits per-file sections, derives each file's change status, and rebuilds
 * before/after texts so a shelf preview can render without git object access.
 */

export type PatchFileStatus = "A" | "M" | "D";

export type PatchFileSummary = {
  path: string;
  status: PatchFileStatus;
};

export type PatchFileTexts = {
  before: string | null;
  after: string | null;
};

function decodeGitQuotedPath(value: string): string | null {
  if (!value.startsWith('"')) {
    return value.replace(/\t.*$/, "");
  }
  const bytes: number[] = [];
  for (let index = 1; index < value.length; index++) {
    const character = value[index]!;
    if (character === '"') {
      return new TextDecoder().decode(Uint8Array.from(bytes));
    }
    if (character !== "\\") {
      bytes.push(...new TextEncoder().encode(character));
      continue;
    }
    const escaped = value[++index];
    if (escaped === undefined) {
      return null;
    }
    const simpleEscapes: Record<string, number> = {
      a: 7,
      b: 8,
      t: 9,
      n: 10,
      v: 11,
      f: 12,
      r: 13,
      '"': 34,
      "\\": 92,
    };
    if (simpleEscapes[escaped] !== undefined) {
      bytes.push(simpleEscapes[escaped]);
      continue;
    }
    if (/[0-7]/.test(escaped)) {
      let octal = escaped;
      while (octal.length < 3 && /[0-7]/.test(value[index + 1] ?? "")) {
        octal += value[++index]!;
      }
      bytes.push(Number.parseInt(octal, 8));
      continue;
    }
    bytes.push(...new TextEncoder().encode(escaped));
  }
  return null;
}

function stripPrefix(pathLine: string): string | null {
  // "--- a/foo.ts" | "--- /dev/null"; returns null for /dev/null.
  const match = pathLine.match(/^(?:---|\+\+\+) (.+)$/);
  if (!match) {
    return null;
  }
  const raw = decodeGitQuotedPath(match[1]!.trim());
  if (raw === null) {
    return null;
  }
  if (raw === "/dev/null") {
    return null;
  }
  return raw.replace(/^[ab]\//, "");
}

type HunkMeta = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
};

type FileSection = {
  path: string;
  oldPath: string | null;
  newPath: string | null;
  lines: string[];
  hunkCount: number;
  hunks: HunkMeta[];
};

const HUNK_GAP_MARKER = "__HUNK_GAP__";

function parseHunkHeader(line: string): HunkMeta | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) {
    return null;
  }
  return {
    oldStart: Number(match[1]),
    oldLines: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newLines: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function splitSections(patch: string): FileSection[] {
  const sections: FileSection[] = [];
  let current: FileSection | null = null;
  let inHunks = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current && current.path) {
        sections.push(current);
      }
      current = {
        path: "",
        oldPath: null,
        newPath: null,
        lines: [],
        hunkCount: 0,
        hunks: [],
      };
      inHunks = false;
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("--- ")) {
      current.oldPath = stripPrefix(line);
      continue;
    }
    if (line.startsWith("+++ ")) {
      current.newPath = stripPrefix(line);
      current.path = current.newPath ?? current.oldPath ?? "";
      inHunks = false;
      continue;
    }
    if (line.startsWith("@@")) {
      const meta = parseHunkHeader(line);
      if (meta) {
        if (inHunks && current.lines.length > 0) {
          current.lines.push(HUNK_GAP_MARKER);
        }
        current.hunks.push(meta);
      }
      current.hunkCount += 1;
      inHunks = true;
      continue;
    }
    if (
      inHunks &&
      !line.startsWith("diff --git") &&
      !line.startsWith("--- ") &&
      !line.startsWith("+++ ")
    ) {
      current.lines.push(line);
    }
  }
  if (current && current.path) {
    sections.push(current);
  }
  return sections;
}

/** Per-file status summaries for a unified patch, in patch order. */
export function parsePatchFileSummaries(patch: string): PatchFileSummary[] {
  const summaries: PatchFileSummary[] = [];
  const seen = new Set<string>();
  for (const section of splitSections(patch)) {
    if (seen.has(section.path)) {
      continue;
    }
    seen.add(section.path);
    const status: PatchFileStatus =
      section.oldPath === null ? "A" : section.newPath === null ? "D" : "M";
    summaries.push({ path: section.path, status });
  }
  return summaries;
}

/**
 * Rebuilds the two revision texts of `path` from the patch. Returns null when
 * the patch has no section for the path.
 *
 * When a file has multiple hunks the patch only contains those hunks; the
 * gaps between them are not represented. We insert a visible placeholder so a
 * truncated preview is never rendered as a complete file.
 */
export function extractPatchFileTexts(
  patch: string,
  path: string,
): PatchFileTexts | null {
  const section = splitSections(patch).find(
    (candidate) => candidate.path === path,
  );
  if (!section) {
    return null;
  }
  const before: string[] = [];
  const after: string[] = [];
  for (const line of section.lines) {
    if (line === HUNK_GAP_MARKER) {
      before.push("...");
      after.push("...");
      continue;
    }
    if (line.startsWith("+")) {
      after.push(line.slice(1));
    } else if (line.startsWith("-")) {
      before.push(line.slice(1));
    } else if (line.startsWith("\\")) {
      continue;
    } else {
      const context = line.startsWith(" ") ? line.slice(1) : line;
      before.push(context);
      after.push(context);
    }
  }
  return {
    before: section.oldPath === null ? null : before.join("\n"),
    after: section.newPath === null ? null : after.join("\n"),
  };
}

/** True when the stored patch truncates the file (multiple distant hunks). */
export function isPatchPreviewTruncated(patch: string, path: string): boolean {
  const section = splitSections(patch).find(
    (candidate) => candidate.path === path,
  );
  return Boolean(section && section.hunkCount > 1);
}
