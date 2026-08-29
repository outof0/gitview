import { describe, expect, it } from "vitest";
import {
  WORKSPACE_TAB_LABELS,
  WORKSPACE_TABS,
  workspaceTabCount,
} from "../workspaceTabCounts";

describe("workspaceTabCounts", () => {
  it("labels the five Git Workspace tabs", () => {
    expect(WORKSPACE_TABS.map((tab) => WORKSPACE_TAB_LABELS[tab])).toEqual([
      "Changes",
      "Log",
      "Blame",
      "Temporary Work",
      "Review",
    ]);
  });

  it("shows counts only when work exists", () => {
    const empty = { changeCount: 0, temporaryCount: 0, reviewCount: 0 };
    expect(workspaceTabCount("changes", empty)).toBeNull();
    expect(workspaceTabCount("temporary", empty)).toBeNull();
    expect(workspaceTabCount("review", empty)).toBeNull();
    expect(workspaceTabCount("log", empty)).toBeNull();

    const busy = { changeCount: 7, temporaryCount: 3, reviewCount: 2 };
    expect(workspaceTabCount("changes", busy)).toBe(7);
    expect(workspaceTabCount("temporary", busy)).toBe(3);
    expect(workspaceTabCount("review", busy)).toBe(2);
    expect(workspaceTabCount("blame", busy)).toBeNull();
  });
});
