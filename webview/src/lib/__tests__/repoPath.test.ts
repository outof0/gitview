import { describe, expect, it } from "vitest";
import { repoPathsEqual } from "../repoPath";

describe("repoPathsEqual", () => {
  it("treats ./prefix and slashes as equivalent", () => {
    expect(repoPathsEqual("./src/app.ts", "src/app.ts")).toBe(true);
    expect(repoPathsEqual("src\\app.ts", "src/app.ts")).toBe(true);
  });
});