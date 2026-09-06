import { describe, expect, it } from "vitest";
import {
  HOST_EVENT_TYPES,
  PROTOCOL_VERSION,
  createHostError,
  createHostResponse,
  isProtocolMessage,
  parseWebviewRequest,
  parseWebviewRequestResult,
} from "../index";
import { createError } from "../../errors/codes";
import { isSyncOperationEvent } from "../../types/sync";

describe("protocol", () => {
  it("parses valid webview requests", () => {
    const req = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: "req-1",
      type: "repo.refresh",
      payload: {},
    };
    expect(parseWebviewRequest(req)?.type).toBe("repo.refresh");
    expect(isProtocolMessage(req)).toBe(true);
  });

  it("rejects unsupported protocol versions", () => {
    const raw = {
      protocolVersion: 99,
      requestId: "x",
      type: "repo.refresh",
      payload: {},
    };
    expect(parseWebviewRequest(raw)).toBeNull();
    expect(parseWebviewRequestResult(raw)).toMatchObject({
      ok: false,
      requestId: "x",
      code: "PROTOCOL_VERSION_UNSUPPORTED",
    });
  });

  it("rejects unknown request types and malformed payloads", () => {
    const unknown = parseWebviewRequestResult({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "unknown-1",
      type: "plugin.unknown",
      payload: {},
    });
    expect(unknown).toMatchObject({ ok: false, code: "INVALID_REQUEST" });

    const malformed = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: "stage-1",
      type: "changes.stage",
      payload: { repoId: "repo", paths: "not-an-array" },
    };
    expect(parseWebviewRequest(malformed)).toBeNull();
    expect(isProtocolMessage(malformed)).toBe(false);
  });

  it("validates nested payload values", () => {
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "review-1",
        type: "review.createLineComment",
        payload: {
          repoId: "repo",
          providerId: "github",
          reviewId: "1",
          path: "a.ts",
          line: 0,
          body: "comment",
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("validates repository acquisition and recovery requests", () => {
    for (const type of [
      "workspace.openFolder",
      "workspace.clone",
      "workspace.manageTrust",
      "workspace.collapsePanel",
    ]) {
      expect(
        parseWebviewRequest({
          protocolVersion: PROTOCOL_VERSION,
          requestId: type,
          type,
          payload: {},
        })?.type,
      ).toBe(type);
    }

    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "remote-1",
        type: "repository.addRemote",
        payload: { repoId: "repo" },
      })?.type,
    ).toBe("repository.addRemote");
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "remote-2",
        type: "repository.addRemote",
        payload: {},
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("validates sync cancellation requests", () => {
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "cancel-1",
        type: "sync.cancel",
        payload: { operationId: "sync-1" },
      })?.type,
    ).toBe("sync.cancel");

    for (const payload of [{}, { operationId: "" }, { operationId: 1 }]) {
      expect(
        parseWebviewRequestResult({
          protocolVersion: PROTOCOL_VERSION,
          requestId: "cancel-invalid",
          type: "sync.cancel",
          payload,
        }),
      ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    }
  });

  it("validates strict destructive confirmation submissions", () => {
    const evidence = {
      version: 1,
      action: "hard_reset",
      repoId: "repo",
      targetSha: "target",
      resetMode: "hard",
      expectedTypedValue: "main",
      repository: {
        headSha: "head",
        currentBranch: "main",
        dirty: true,
        conflictCount: 0,
        changeDigest: null,
        operation: "none",
      },
    };
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "reset-1",
        type: "log.reset",
        payload: {
          repoId: "repo",
          sha: "target",
          mode: "hard",
          confirmation: { evidence, typedValue: "main" },
        },
      })?.type,
    ).toBe("log.reset");
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "reset-2",
        type: "log.reset",
        payload: {
          repoId: "repo",
          sha: "target",
          mode: "hard",
          confirmation: {
            evidence: { ...evidence, targetSha: "" },
            typedValue: "main",
          },
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });

    const rollbackEvidence = {
      version: 1,
      action: "rollback",
      repoId: "repo",
      paths: ["tracked.ts", "untracked.txt"],
      unversionedPaths: ["untracked.txt"],
      expectedTypedValue: "DELETE",
      repository: evidence.repository,
    };
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "rollback-1",
        type: "changes.rollback",
        payload: {
          repoId: "repo",
          paths: rollbackEvidence.paths,
          confirmation: {
            evidence: rollbackEvidence,
            typedValue: "DELETE",
          },
        },
      })?.type,
    ).toBe("changes.rollback");
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "rollback-2",
        type: "changes.rollback",
        payload: {
          repoId: "repo",
          paths: rollbackEvidence.paths,
          confirmation: {
            evidence: {
              ...rollbackEvidence,
              unversionedPaths: ["other.txt"],
            },
            typedValue: "DELETE",
          },
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });

    const forceCheckoutEvidence = {
      version: 1,
      action: "force_checkout",
      repoId: "repo",
      targetRef: "feature",
      targetSha: "feature-head",
      expectedTypedValue: "feature",
      repository: evidence.repository,
    };
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "force-checkout-1",
        type: "branch.checkout",
        payload: {
          repoId: "repo",
          ref: "feature",
          force: true,
          confirmation: {
            evidence: forceCheckoutEvidence,
            typedValue: "feature",
          },
        },
      })?.type,
    ).toBe("branch.checkout");

    const multiForceCheckoutEvidence = {
      version: 1,
      action: "force_checkout_multi",
      repoId: "repo",
      targetRef: "feature",
      targets: [
        {
          repoId: "repo",
          targetSha: "feature-head",
          repository: evidence.repository,
        },
      ],
      expectedTypedValue: "feature",
      repository: evidence.repository,
    };
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "force-checkout-multi-1",
        type: "branch.syncOperation",
        payload: {
          repoId: "repo",
          ref: "feature",
          force: true,
          confirmation: {
            evidence: multiForceCheckoutEvidence,
            typedValue: "feature",
          },
        },
      })?.type,
    ).toBe("branch.syncOperation");

    const worktreeEvidence = {
      version: 1,
      action: "remove_dirty_worktree",
      repoId: "repo",
      target: {
        path: "/repo-worktree",
        headSha: "worktree-head",
        branch: "feature",
        dirty: true,
      },
      expectedTypedValue: "/repo-worktree",
      repository: evidence.repository,
    };
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "worktree-remove-1",
        type: "worktree.remove",
        payload: {
          repoId: "repo",
          path: "/repo-worktree",
          confirmation: {
            evidence: worktreeEvidence,
            typedValue: "/repo-worktree",
          },
        },
      })?.type,
    ).toBe("worktree.remove");
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "worktree-remove-2",
        type: "worktree.remove",
        payload: {
          repoId: "repo",
          path: "/repo-worktree",
          confirmation: {
            evidence: {
              ...worktreeEvidence,
              target: { ...worktreeEvidence.target, extra: true },
            },
            typedValue: "/repo-worktree",
          },
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });

    const selectedEvidence = {
      version: 1,
      action: "drop_selected",
      repoId: "repo",
      targetSha: "head",
      path: "src/app.ts",
      selection: { hunkIndexes: [0], lines: [] },
      expectedTypedValue: "head",
      repository: evidence.repository,
    };
    expect(
      parseWebviewRequest({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "drop-selected-1",
        type: "log.dropSelectedChanges",
        payload: {
          repoId: "repo",
          sha: "head",
          path: "src/app.ts",
          hunkIndexes: [0],
          confirmation: {
            evidence: selectedEvidence,
            typedValue: "head",
          },
        },
      })?.type,
    ).toBe("log.dropSelectedChanges");
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "drop-selected-2",
        type: "log.dropSelectedChanges",
        payload: {
          repoId: "repo",
          sha: "head",
          path: "src/app.ts",
          hunkIndexes: [0],
          confirmation: {
            evidence: {
              ...selectedEvidence,
              selection: { hunkIndexes: [], lines: [], extra: true },
            },
            typedValue: "head",
          },
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("validates structured sync lifecycle events", () => {
    const accepted = {
      operationId: "sync-1",
      requestId: "fetch-1",
      operation: "fetch",
      repoIds: ["repo"],
      sequence: 1,
      timestamp: 1,
      state: "accepted",
      phase: "preparing",
      cancellable: true,
    };
    expect(isSyncOperationEvent(accepted)).toBe(true);
    expect(isSyncOperationEvent({ ...accepted, sequence: 0 })).toBe(false);
    expect(
      isSyncOperationEvent({
        ...accepted,
        state: "completed",
        outcome: { kind: "rejected", message: "rejected" },
      }),
    ).toBe(false);
    expect(HOST_EVENT_TYPES).toContain("sync.operation");
  });

  it("creates host success and error responses", () => {
    const ok = createHostResponse("req-2", "status.list", {
      repoId: "abc",
      files: [],
      changelists: [],
      mode: "staging",
      showIgnored: false,
      showUnversioned: true,
      refreshedAt: 1,
    });
    expect(ok.ok).toBe(true);

    const err = createHostError(
      "req-3",
      createError("REPOSITORY_NOT_FOUND", "missing"),
    );
    expect(err.ok).toBe(false);
    expect(err.error.code).toBe("REPOSITORY_NOT_FOUND");
  });

  it("rejects option-shaped git operands in commit sha fields", () => {
    // `{ mode: "soft", sha: "--hard" }` used to validate and then produce
    // `git reset --soft --hard`, a hard reset that destroys uncommitted work
    // without the hard-reset confirmation.
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "reset-opt-1",
        type: "log.reset",
        payload: { repoId: "repo", sha: "--hard", mode: "soft" },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });

    // `--abort`/`--continue` would otherwise drive an in-progress
    // cherry-pick through a field that is supposed to carry a commit.
    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "cherry-opt-1",
        type: "log.cherryPick",
        payload: { repoId: "repo", sha: "--abort" },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });

    expect(
      parseWebviewRequestResult({
        protocolVersion: PROTOCOL_VERSION,
        requestId: "drop-opt-1",
        type: "log.dropSelectedChanges",
        payload: {
          repoId: "repo",
          sha: "--hard",
          path: "file.txt",
          hunkIndexes: [0],
        },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });
});
