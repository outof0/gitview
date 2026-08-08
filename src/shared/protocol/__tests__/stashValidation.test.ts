import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, parseWebviewRequest } from "../index";

function req(type: string, payload: unknown) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-1",
    type,
    payload,
  };
}

describe("stash request validation", () => {
  it("accepts stash.detail with a repo and index", () => {
    expect(parseWebviewRequest(req("stash.detail", { repoId: "r", index: 0 }))).not
      .toBeNull();
  });

  it("rejects stash.detail with a negative or fractional index", () => {
    expect(parseWebviewRequest(req("stash.detail", { repoId: "r", index: -1 }))).toBeNull();
    expect(parseWebviewRequest(req("stash.detail", { repoId: "r", index: 1.5 }))).toBeNull();
  });

  it("accepts stash.fileDiff with a valid origin", () => {
    for (const origin of ["tracked", "untracked", "index"]) {
      expect(
        parseWebviewRequest(
          req("stash.fileDiff", { repoId: "r", index: 0, path: "a.ts", origin }),
        ),
      ).not.toBeNull();
    }
  });

  it("accepts stash.fileDiff without an origin", () => {
    expect(
      parseWebviewRequest(req("stash.fileDiff", { repoId: "r", index: 0, path: "a.ts" })),
    ).not.toBeNull();
  });

  it("rejects stash.fileDiff with an unknown origin", () => {
    expect(
      parseWebviewRequest(
        req("stash.fileDiff", { repoId: "r", index: 0, path: "a.ts", origin: "worktree" }),
      ),
    ).toBeNull();
  });

  it("rejects stash.fileDiff without a path", () => {
    expect(
      parseWebviewRequest(req("stash.fileDiff", { repoId: "r", index: 0 })),
    ).toBeNull();
  });

  it("accepts stash.push with keepIndex and includeUntracked", () => {
    expect(
      parseWebviewRequest(
        req("stash.push", {
          repoId: "r",
          message: "wip",
          keepIndex: true,
          includeUntracked: true,
        }),
      ),
    ).not.toBeNull();
  });

  it("rejects a non-boolean keepIndex", () => {
    expect(
      parseWebviewRequest(req("stash.push", { repoId: "r", keepIndex: "yes" })),
    ).toBeNull();
  });

  it("accepts reinstateIndex on apply and pop", () => {
    expect(
      parseWebviewRequest(
        req("stash.apply", { repoId: "r", index: 0, reinstateIndex: true }),
      ),
    ).not.toBeNull();
    expect(
      parseWebviewRequest(
        req("stash.pop", { repoId: "r", index: 1, reinstateIndex: false }),
      ),
    ).not.toBeNull();
  });

  it("rejects a non-boolean reinstateIndex", () => {
    expect(
      parseWebviewRequest(req("stash.apply", { repoId: "r", index: 0, reinstateIndex: 1 })),
    ).toBeNull();
  });

  it("accepts stash.branch with a repo, index and branch name", () => {
    expect(
      parseWebviewRequest(
        req("stash.branch", { repoId: "r", index: 0, branch: "feature/x" }),
      ),
    ).not.toBeNull();
  });

  it("rejects stash.branch without a branch name", () => {
    expect(
      parseWebviewRequest(req("stash.branch", { repoId: "r", index: 0 })),
    ).toBeNull();
  });

  it("accepts stash.clear with only a repo", () => {
    expect(parseWebviewRequest(req("stash.clear", { repoId: "r" }))).not.toBeNull();
  });

  it("rejects stash.clear without a repo", () => {
    expect(parseWebviewRequest(req("stash.clear", {}))).toBeNull();
  });
});
