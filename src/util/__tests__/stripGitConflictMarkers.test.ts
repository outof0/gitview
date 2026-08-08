import { describe, expect, it } from "vitest";
import {
  hasGitConflictMarkers,
  stripGitConflictMarkers,
} from "../stripGitConflictMarkers";

describe("stripGitConflictMarkers", () => {
  it("removes marker lines but keeps both sides' code", () => {
    const input = [
      "before",
      "<<<<<<< HEAD",
      "ours",
      "=======",
      "theirs",
      ">>>>>>> feature",
      "after",
    ].join("\n");
    expect(stripGitConflictMarkers(input)).toBe(
      ["before", "ours", "theirs", "after"].join("\n"),
    );
  });

  it("strips Incoming-style labels used by VS Code merge UI", () => {
    const input = [
      "<<<<<<< Incoming Change",
      "incoming-line",
      "=======",
      "current-line",
      ">>>>>>> Current Change",
    ].join("\n");
    const out = stripGitConflictMarkers(input);
    expect(out).not.toMatch(/<<<<<<</);
    expect(out).not.toMatch(/=======/);
    expect(out).not.toMatch(/>>>>>>>/);
    expect(out).not.toMatch(/Incoming/);
    expect(out).toContain("incoming-line");
    expect(out).toContain("current-line");
  });

  it("is a no-op for clean source", () => {
    const clean = "export const x = 1;\n";
    expect(stripGitConflictMarkers(clean)).toBe(clean);
  });

  it("detects markers", () => {
    expect(hasGitConflictMarkers("<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> b\n")).toBe(
      true,
    );
    expect(hasGitConflictMarkers("plain\ncode\n")).toBe(false);
  });
});
