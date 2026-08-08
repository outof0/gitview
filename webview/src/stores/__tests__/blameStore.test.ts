import { describe, it, expect, beforeEach } from "vitest";
import { useBlameStore } from "../blameStore";

describe("blameStore", () => {
  beforeEach(() => {
    useBlameStore.getState().reset();
  });

  it("setLoading marks the requested side as loading", () => {
    useBlameStore.getState().setLoading("ours", "src/app.ts");
    expect(useBlameStore.getState().ours.loading).toBe(true);
    expect(useBlameStore.getState().ours.relativePath).toBe("src/app.ts");
  });

  it("setResult stores blame lines on success", () => {
    useBlameStore.getState().setLoading("ours", "src/app.ts");
    useBlameStore.getState().setResult({
      relativePath: "src/app.ts",
      side: "ours",
      lines: [
        {
          lineNumber: 1,
          sha: "abc1234567890abcdef1234567890abcdef1234",
          shortSha: "abc1234",
          author: "Jane Doe",
          authorEmail: "j@example.com",
          authorTime: 1,
          summary: "Fix",
        },
      ],
    });
    const ours = useBlameStore.getState().ours;
    expect(ours.loading).toBe(false);
    expect(ours.error).toBeNull();
    expect(ours.lines?.[0]?.author).toBe("Jane Doe");
  });

  it("setResult stores an error and clears lines", () => {
    useBlameStore.getState().setLoading("theirs", "src/app.ts");
    useBlameStore.getState().setResult({
      relativePath: "src/app.ts",
      side: "theirs",
      error: { message: "binary file" },
    });
    const theirs = useBlameStore.getState().theirs;
    expect(theirs.loading).toBe(false);
    expect(theirs.error).toBe("binary file");
    expect(theirs.lines).toBeNull();
  });

  it("ignores stale results for a different path", () => {
    useBlameStore.getState().setLoading("ours", "src/a.ts");
    useBlameStore.getState().setResult({
      relativePath: "src/b.ts",
      side: "ours",
      lines: [],
    });
    expect(useBlameStore.getState().ours.loading).toBe(true);
    expect(useBlameStore.getState().ours.lines).toBeNull();
  });
});