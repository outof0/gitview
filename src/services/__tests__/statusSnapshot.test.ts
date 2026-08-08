import { describe, expect, it, vi } from "vitest";
import type { GitFileStatus } from "../../shared/types/status";
import type { ChangelistStorage } from "../../storage/changelistStorage";
import { buildRepoStatusSnapshot } from "../statusSnapshot";

const file: GitFileStatus = {
  repoId: "repo",
  path: "src/index.ts",
  kind: "modified",
  indexStatus: " ",
  workingTreeStatus: "M",
  staged: false,
  conflicted: false,
  binary: false,
};

function statusApi() {
  return {
    getStatus: vi.fn(async () => ({ branch: null, files: [file] })),
  } as never;
}

describe("buildRepoStatusSnapshot", () => {
  it("uses staging mode without creating hidden changelist state", async () => {
    const mergeWithStatus = vi.fn();
    const storage = { mergeWithStatus } as unknown as ChangelistStorage;

    const snapshot = await buildRepoStatusSnapshot(
      statusApi(),
      "/repo",
      "repo",
      { mode: "staging", changelistStorage: storage },
    );

    expect(snapshot.mode).toBe("staging");
    expect(snapshot.changelists).toEqual([]);
    expect(mergeWithStatus).not.toHaveBeenCalled();
  });

  it("hydrates changelists only when changelist mode is selected", async () => {
    const changelist = {
      id: "repo:changes",
      repoId: "repo",
      name: "Changes",
      active: true,
      filePaths: [file.path],
      createdAt: 1,
      updatedAt: 1,
    };
    const mergeWithStatus = vi.fn(async () => [changelist]);
    const storage = { mergeWithStatus } as unknown as ChangelistStorage;

    const snapshot = await buildRepoStatusSnapshot(
      statusApi(),
      "/repo",
      "repo",
      { mode: "changelist", changelistStorage: storage },
    );

    expect(snapshot.mode).toBe("changelist");
    expect(snapshot.changelists).toEqual([changelist]);
    expect(mergeWithStatus).toHaveBeenCalledWith("repo", [file.path]);
  });
});
