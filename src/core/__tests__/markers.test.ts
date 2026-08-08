import { describe, it, expect } from "vitest";
import {
  hasConflictMarkers,
  extractLabels,
  parseMarkers,
  hasLeftoverMarkers,
} from "../markers";

const basic = `a
<<<<<<< HEAD
ours line
=======
theirs line
>>>>>>> feature/x
b`;

const diff3 = `a
<<<<<<< HEAD
ours line
||||||| merged common ancestors
base line
=======
theirs line
>>>>>>> feature/x
b`;

describe("markers — detection", () => {
  it("detects real marker lines", () => {
    expect(hasConflictMarkers(basic)).toBe(true);
  });

  it("does NOT flag prose containing marker-like characters mid-line", () => {
    const prose = "see ======= below\nand <<<<<<< arrows in text";
    expect(hasConflictMarkers(prose)).toBe(false);
  });

  it("does NOT flag a line of 8+ equals without trailing space rule break", () => {
    // 7 equals at line start IS a marker; guard against false negatives:
    expect(hasConflictMarkers("=======")).toBe(true);
    // but '========' (8) at start still matches /^={7}(?: |$)/? No: char after is '='
    expect(hasConflictMarkers("========")).toBe(false);
  });
});

describe("markers — labels", () => {
  it("extracts ours/theirs labels", () => {
    expect(extractLabels(basic)).toEqual({
      oursLabel: "HEAD",
      theirsLabel: "feature/x",
    });
  });
});

describe("markers — parse", () => {
  it("parses a basic conflict", () => {
    const r = parseMarkers(basic);
    expect(r.malformed).toBe(false);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]!.ours).toBe("ours line");
    expect(r.conflicts[0]!.theirs).toBe("theirs line");
    expect(r.conflicts[0]!.base).toBeUndefined();
  });

  it("parses diff3 base section", () => {
    const r = parseMarkers(diff3);
    expect(r.malformed).toBe(false);
    expect(r.conflicts[0]!.base).toBe("base line");
    expect(r.conflicts[0]!.ours).toBe("ours line");
    expect(r.conflicts[0]!.theirs).toBe("theirs line");
  });

  it("flags unbalanced markers as malformed", () => {
    const bad = `<<<<<<< HEAD
ours
=======
theirs`; // no closing >>>>>>>
    expect(parseMarkers(bad).malformed).toBe(true);
  });

  it("flags nested start as malformed", () => {
    const bad = `<<<<<<< HEAD
ours
<<<<<<< nested
=======
theirs
>>>>>>> x`;
    expect(parseMarkers(bad).malformed).toBe(true);
  });
});

describe("markers — leftover validation", () => {
  it("detects leftover markers in resolved content", () => {
    expect(hasLeftoverMarkers(basic)).toBe(true);
    expect(hasLeftoverMarkers("clean\nresolved\ncontent")).toBe(false);
  });
});
