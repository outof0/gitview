import { describe, expect, it } from "vitest";
import { createConfigurableGitRunner } from "../git/exec";

describe("configurable Git runner", () => {
  it("defaults to git without mutating other runners", () => {
    const first = createConfigurableGitRunner();
    const second = createConfigurableGitRunner("/custom/git");

    expect(first.getExecutable()).toBe("git");
    expect(second.getExecutable()).toBe("/custom/git");
    second.setExecutable(" /next/git ");
    expect(second.getExecutable()).toBe("/next/git");
    expect(first.getExecutable()).toBe("git");
  });

  it("falls back to git for blank configuration", () => {
    const runner = createConfigurableGitRunner("/custom/git");
    runner.setExecutable("   ");
    expect(runner.getExecutable()).toBe("git");
  });
});
