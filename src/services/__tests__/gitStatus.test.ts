import { describe, expect, it } from "vitest";
import {
  mapEntryToFileStatus,
  parsePorcelainV1Z,
} from "../git/status";

describe("git status parsing", () => {
  it("parses branch header with ahead/behind", () => {
    const output = "## main...origin/main [ahead 2, behind 1]\0 M file.ts\0";
    const parsed = parsePorcelainV1Z(output);
    expect(parsed.branch?.currentBranch).toBe("main");
    expect(parsed.branch?.upstream).toBe("origin/main");
    expect(parsed.branch?.ahead).toBe(2);
    expect(parsed.branch?.behind).toBe(1);
    expect(parsed.entries).toHaveLength(1);
  });

  it("parses detached HEAD", () => {
    const output = "## HEAD (no branch)\0";
    const parsed = parsePorcelainV1Z(output);
    expect(parsed.branch?.isDetached).toBe(true);
    expect(parsed.branch?.currentBranch).toBeNull();
  });

  it("maps porcelain codes to GitView status kinds", () => {
    const modified = mapEntryToFileStatus("repo-1", { xy: " M", path: "a.ts" });
    expect(modified.kind).toBe("modified");
    expect(modified.staged).toBe(false);

    const conflict = mapEntryToFileStatus("repo-1", { xy: "UU", path: "b.ts" });
    expect(conflict.kind).toBe("conflicted");
    expect(conflict.conflicted).toBe(true);

    const untracked = mapEntryToFileStatus("repo-1", {
      xy: "??",
      path: "new.ts",
    });
    expect(untracked.kind).toBe("unversioned");
  });

  it("parses rename entries", () => {
    const output = "R  new.ts\0old.ts\0";
    const parsed = parsePorcelainV1Z(output);
    expect(parsed.entries[0]?.oldPath).toBe("old.ts");
    expect(parsed.entries[0]?.path).toBe("new.ts");
    expect(parsed.entries).toHaveLength(1);
  });

  it("keeps status codes as strings for a short porcelain code", () => {
    const short = mapEntryToFileStatus("repo-1", { xy: "M", path: "a.ts" });
    expect(short.indexStatus).toBe("M");
    expect(short.workingTreeStatus).toBe("");
    expect(short.workingTreeStatus).not.toBeUndefined();
  });

  it("preserves legal leading and trailing whitespace in paths", () => {
    const output = "??  leading and trailing  \0";
    const parsed = parsePorcelainV1Z(output);
    expect(parsed.entries[0]?.path).toBe(" leading and trailing  ");
  });
});
