import { describe, it, expect, beforeEach } from "vitest";
import { normalizeGitHistoryPath, useGitPanelStore } from "../gitPanelStore";

describe("gitPanelStore", () => {
  beforeEach(() => {
    useGitPanelStore.getState().closeGitHistory();
  });

  it("normalizes ./ and . as the same folder path", () => {
    expect(normalizeGitHistoryPath("./")).toBe(".");
    expect(normalizeGitHistoryPath(".")).toBe(".");
    expect(normalizeGitHistoryPath("src/app.ts")).toBe("src/app.ts");
  });

  it("accepts git:logResult when stored path is ./ and response path is .", () => {
    useGitPanelStore.getState().openGitHistory("./", true);
    useGitPanelStore.getState().setGitHistoryResult({
      path: ".",
      commits: [
        {
          sha: "abc",
          shortSha: "abc",
          author: "A",
          authorEmail: "a@b.c",
          authorTime: 1,
          subject: "init",
          changedFiles: [],
        },
      ],
    });
    const { history } = useGitPanelStore.getState();
    expect(history.loading).toBe(false);
    expect(history.commits).toHaveLength(1);
  });
});
