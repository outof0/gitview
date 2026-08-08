import { describe, expect, it } from "vitest";
import { parseNameStatusZ } from "../git/stash";

/** Builds a NUL-delimited payload the way `git diff --name-status -z` does. */
function z(...fields: string[]): string {
  return fields.length > 0 ? `${fields.join("\0")}\0` : "";
}

describe("parseNameStatusZ", () => {
  it("parses simple status/path pairs", () => {
    expect(parseNameStatusZ(z("M", "src/a.ts", "A", "src/b.ts"), "tracked")).toEqual([
      { path: "src/a.ts", oldPath: null, status: "M", origin: "tracked" },
      { path: "src/b.ts", oldPath: null, status: "A", origin: "tracked" },
    ]);
  });

  it("consumes the extra path emitted for renames", () => {
    expect(parseNameStatusZ(z("R100", "old.ts", "new.ts"), "tracked")).toEqual([
      { path: "new.ts", oldPath: "old.ts", status: "R", origin: "tracked" },
    ]);
  });

  it("consumes the extra path emitted for copies", () => {
    expect(parseNameStatusZ(z("C075", "from.ts", "to.ts"), "tracked")).toEqual([
      { path: "to.ts", oldPath: "from.ts", status: "C", origin: "tracked" },
    ]);
  });

  it("keeps following entries aligned after a rename", () => {
    const parsed = parseNameStatusZ(
      z("R100", "old.ts", "new.ts", "M", "after.ts"),
      "tracked",
    );
    expect(parsed).toEqual([
      { path: "new.ts", oldPath: "old.ts", status: "R", origin: "tracked" },
      { path: "after.ts", oldPath: null, status: "M", origin: "tracked" },
    ]);
  });

  it("preserves paths containing spaces and non-ASCII characters", () => {
    const parsed = parseNameStatusZ(z("M", "my dir/tệp mới.ts"), "tracked");
    expect(parsed[0]?.path).toBe("my dir/tệp mới.ts");
  });

  it("ignores the trailing empty field after the final NUL", () => {
    expect(parseNameStatusZ(z("M", "a.ts"), "tracked")).toHaveLength(1);
  });

  it("returns nothing for empty output", () => {
    expect(parseNameStatusZ("", "tracked")).toEqual([]);
  });

  it("tags entries with the requested origin", () => {
    expect(parseNameStatusZ(z("M", "a.ts"), "index")[0]?.origin).toBe("index");
  });

  it("drops a trailing status with no path rather than emitting a partial entry", () => {
    expect(parseNameStatusZ(z("M", "a.ts") + "D", "tracked")).toEqual([
      { path: "a.ts", oldPath: null, status: "M", origin: "tracked" },
    ]);
  });

  it("normalizes unknown status letters to a modification", () => {
    expect(parseNameStatusZ(z("X", "a.ts"), "tracked")[0]?.status).toBe("M");
  });
});
