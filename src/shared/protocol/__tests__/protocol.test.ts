import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  createHostError,
  createHostResponse,
  isProtocolMessage,
  parseWebviewRequest,
  parseWebviewRequestResult,
} from "../index";
import { createError } from "../../errors/codes";

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
});
