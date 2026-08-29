import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import {
  isRepoSnapshot,
  isSyncOperationMessage,
} from "../hostMessageGuards";

const repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: "abc123",
  upstream: "origin/main",
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" },
  ahead: 0,
  behind: 0,
  conflictCount: 0,
  changeDigest: null,
  dirty: false,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

function message(payload: unknown) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "repo.snapshot",
    payload,
  };
}

describe("isRepoSnapshot", () => {
  it("accepts a valid repository snapshot", () => {
    expect(
      isRepoSnapshot(
        message({
          repositories: [repository],
          activeRepoId: repository.id,
          multiRootDiverged: false,
        }),
      ),
    ).toBe(true);
  });

  it("rejects malformed repositories and stale active ids", () => {
    expect(
      isRepoSnapshot(
        message({
          repositories: [{ ...repository, trusted: "yes" }],
          activeRepoId: repository.id,
          multiRootDiverged: false,
        }),
      ),
    ).toBe(false);
    expect(
      isRepoSnapshot(
        message({
          repositories: [repository],
          activeRepoId: "missing",
          multiRootDiverged: false,
        }),
      ),
    ).toBe(false);
  });
});

describe("isSyncOperationMessage", () => {
  const payload = {
    operationId: "sync-1",
    requestId: "fetch-1",
    operation: "fetch",
    repoIds: [repository.id],
    sequence: 2,
    timestamp: 1,
    state: "running",
    phase: "fetching",
    cancellable: true,
  };

  it("accepts a valid lifecycle envelope", () => {
    expect(
      isSyncOperationMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "sync.operation",
        payload,
      }),
    ).toBe(true);
  });

  it("rejects malformed payloads and protocol versions", () => {
    expect(
      isSyncOperationMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "sync.operation",
        payload: { ...payload, sequence: 0 },
      }),
    ).toBe(false);
    expect(
      isSyncOperationMessage({
        protocolVersion: PROTOCOL_VERSION + 1,
        type: "sync.operation",
        payload,
      }),
    ).toBe(false);
  });
});
