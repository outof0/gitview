import { describe, it, expect } from "vitest";
import {
  parseBlamePorcelain,
  truncateBlameLines,
  BLAME_MAX_LINES,
} from "../blameParser";

const SAMPLE_PORCELAIN = `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 1 1 2
author John Doe
author-mail <john@example.com>
author-time 1719000000
author-tz +0700
committer John Doe
committer-mail <john@example.com>
committer-time 1719000000
committer-tz +0700
summary Fix greeting
filename src/app.ts
\tconst x = 1;
\t  line two;
a1b2c3d4e5f6789012345678abcdef9012345678 3 3 1
author Alice Smith
author-mail <alice@example.com>
author-time 1718000000
author-tz +0000
committer Alice Smith
committer-mail <alice@example.com>
committer-time 1718000000
committer-tz +0000
summary Refactor util
filename src/app.ts
\tconst y = 2;
`;

describe("parseBlamePorcelain", () => {
  it("parses multi-commit porcelain output into sorted blame lines", () => {
    const lines = parseBlamePorcelain(SAMPLE_PORCELAIN);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      lineNumber: 1,
      sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
      shortSha: "e69de29",
      author: "John Doe",
      authorEmail: "john@example.com",
      authorTime: 1719000000,
      summary: "Fix greeting",
      text: "const x = 1;",
    });
    expect(lines[1]!.lineNumber).toBe(2);
    expect(lines[1]!.author).toBe("John Doe");
    expect(lines[1]!.text).toBe("  line two;");
    expect(lines[2]).toMatchObject({
      lineNumber: 3,
      author: "Alice Smith",
      summary: "Refactor util",
      text: "const y = 2;",
    });
  });

  it("returns empty array for empty input", () => {
    expect(parseBlamePorcelain("")).toEqual([]);
  });

  it("merges per-line source text after a grouped attribution header", () => {
    const porcelain = `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 1 1 3
author John Doe
author-mail <john@example.com>
author-time 1719000000
summary Initial
filename src/app.ts
\tline one
\tline two
\tline three
e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 2 2
author John Doe
author-mail <john@example.com>
author-time 1719000000
summary Initial
filename src/app.ts
\tline two
e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 3 3
author John Doe
author-mail <john@example.com>
author-time 1719000000
summary Initial
filename src/app.ts
\tline three
`;

    const lines = parseBlamePorcelain(porcelain);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.lineNumber)).toEqual([1, 2, 3]);
    expect(lines.map((l) => l.text)).toEqual([
      "line one",
      "line two",
      "line three",
    ]);
  });
});

describe("truncateBlameLines", () => {
  it("does not truncate when under the limit", () => {
    const lines = parseBlamePorcelain(SAMPLE_PORCELAIN);
    const result = truncateBlameLines(lines, 10);
    expect(result.truncated).toBe(false);
    expect(result.lines).toHaveLength(3);
  });

  it("truncates when over the limit", () => {
    const lines = Array.from({ length: BLAME_MAX_LINES + 5 }, (_, i) => ({
      lineNumber: i + 1,
      sha: "a".repeat(40),
      shortSha: "aaaaaaa",
      author: "A",
      authorEmail: "a@b.c",
      authorTime: 0,
      summary: "s",
    }));
    const result = truncateBlameLines(lines);
    expect(result.truncated).toBe(true);
    expect(result.lines).toHaveLength(BLAME_MAX_LINES);
  });
});
