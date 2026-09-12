import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import {
  isRepoSnapshot,
  isSyncOperationMessage,
  isFocusRootRequest,
  isSelectCommitRequest,
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

describe("isFocusRootRequest", () => {
  it("accepts the empty root-focus event", () => {
    expect(
      isFocusRootRequest({
        protocolVersion: PROTOCOL_VERSION,
        type: "git.focusRoot",
        payload: {},
      }),
    ).toBe(true);
  });

  it("rejects unexpected payload fields and stale protocol versions", () => {
    expect(
      isFocusRootRequest({
        protocolVersion: PROTOCOL_VERSION,
        type: "git.focusRoot",
        payload: { path: "src/old.ts" },
      }),
    ).toBe(false);
    expect(
      isFocusRootRequest({
        protocolVersion: PROTOCOL_VERSION + 1,
        type: "git.focusRoot",
        payload: {},
      }),
    ).toBe(false);
  });
});

describe("isSelectCommitRequest", () => {
  it("accepts valid selectCommit payloads", () => {
    expect(
      isSelectCommitRequest({
        protocolVersion: PROTOCOL_VERSION,
        type: "git.selectCommit",
        payload: { repoId: "repo-1", sha: "abc1234" },
      }),
    ).toBe(true);
  });

  it("rejects invalid payloads, wrong types, and stale protocol versions", () => {
    expect(
      isSelectCommitRequest({
        protocolVersion: PROTOCOL_VERSION,
        type: "git.selectCommit",
        payload: { repoId: "repo-1" },
      }),
    ).toBe(false);
    expect(
      isSelectCommitRequest({
        protocolVersion: PROTOCOL_VERSION,
        type: "git.other",
        payload: { repoId: "repo-1", sha: "abc1234" },
      }),
    ).toBe(false);
    expect(
      isSelectCommitRequest({
        protocolVersion: PROTOCOL_VERSION + 1,
        type: "git.selectCommit",
        payload: { repoId: "repo-1", sha: "abc1234" },
      }),
    ).toBe(false);
  });
});
