import { describe, it, expect } from "vitest";
import {
  changesFromSideRevisionRange,
  resolveMergeRefs,
} from "../mergeHistory";

describe("resolveMergeRefs", () => {
  it("returns merge base and side refs when MERGE_HEAD exists", async () => {
    const execGit = async (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "rev-parse --verify MERGE_HEAD") {
        return { stdout: "merge\n", stderr: "" };
      }
      if (key === "merge-base HEAD MERGE_HEAD") {
        return { stdout: "base123\n", stderr: "" };
      }
      throw new Error(`unexpected: ${key}`);
    };
    const result = await resolveMergeRefs(execGit, "/repo");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.refs.mergeBase).toBe("base123");
      expect(result.refs.oursRef).toBe("HEAD");
      expect(result.refs.theirsRef).toBe("MERGE_HEAD");
    }
  });

  it("returns NOT_IN_MERGE without MERGE_HEAD", async () => {
    const execGit = async () => {
      throw new Error("no MERGE_HEAD");
    };
    const result = await resolveMergeRefs(execGit, "/repo");
    expect(result).toMatchObject({ ok: false, code: "NOT_IN_MERGE" });
  });
});

describe("changesFromSideRevisionRange", () => {
  it("builds merge-base..tip range per side", () => {
    const refs = {
      mergeBase: "base",
      oursRef: "HEAD",
      theirsRef: "MERGE_HEAD",
    };
    expect(changesFromSideRevisionRange(refs, "ours")).toBe("base..HEAD");
    expect(changesFromSideRevisionRange(refs, "theirs")).toBe(
      "base..MERGE_HEAD",
    );
  });
});
