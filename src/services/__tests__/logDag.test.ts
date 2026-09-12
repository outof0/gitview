import { describe, expect, it } from "vitest";
import { createLogDagApi } from "../git/logDag";
import type { GitExecFn } from "../git/types";

describe("logDag", () => {
  it("parses a lightweight SHA/parent graph and caches by HEAD+tips", async () => {
    let logCalls = 0;
    const execGit: GitExecFn = async (_root, args) => {
      const key = args.join(" ");
      if (key === "rev-parse HEAD") {
        return { stdout: "aaa\n", stderr: "" };
      }
      if (key === "for-each-ref --format=%(objectname) refs/heads refs/remotes refs/tags") {
        return { stdout: "aaa\nbbb\n", stderr: "" };
      }
      if (
        key ===
        "log --format=%H%x00%P%x00%at --branches --remotes --tags HEAD"
      ) {
        logCalls += 1;
        return {
          stdout: "aaa\u0000bbb\u00003\nbbb\u0000\u00002\n",
          stderr: "",
        };
      }
      throw new Error(`Unexpected: ${key}`);
    };
    const { logDag } = createLogDagApi(execGit);
    const first = await logDag("/repo");
    const second = await logDag("/repo");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok) {
      expect(first.snapshot.headSha).toBe("aaa");
      expect(first.snapshot.refTips).toEqual(["aaa", "bbb"]);
      expect(first.snapshot.nodes).toEqual([
        { sha: "aaa", parentShas: ["bbb"], timestamp: 3 },
        { sha: "bbb", parentShas: [], timestamp: 2 },
      ]);
    }
    expect(logCalls).toBe(1);
  });

  it("returns an empty snapshot when HEAD does not exist", async () => {
    const execGit: GitExecFn = async (_root, args) => {
      const key = args.join(" ");
      if (key === "rev-parse HEAD") {
        throw new Error("unknown revision");
      }
      if (key === "for-each-ref --format=%(objectname) refs/heads refs/remotes refs/tags") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected: ${key}`);
    };
    const { logDag } = createLogDagApi(execGit);
    const result = await logDag("/repo");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.nodes).toEqual([]);
      expect(result.snapshot.headSha).toBeNull();
    }
  });
});
