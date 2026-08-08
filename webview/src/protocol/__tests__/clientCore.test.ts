import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { createProtocolClientTransport } from "../clientCore";

describe("clientCore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects when the host does not respond before timeout", async () => {
    const { request } = createProtocolClientTransport(() => {});

    const pending = request("repo.refresh", {}, 1_000);
    const assertion = expect(pending).rejects.toThrow(
      'Request "repo.refresh" timed out after 1000ms',
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("resolves when the host returns the expected response type", async () => {
    let requestId = "";
    const { handleHostMessage, request } = createProtocolClientTransport((msg) => {
      requestId = (msg as { requestId: string }).requestId;
    });

    const pending = request("status.list", { repoId: "r1" }, 1_000);
    handleHostMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      type: "status.list",
      ok: true,
      payload: { entries: [] },
    });

    await expect(pending).resolves.toEqual({ entries: [] });
    await vi.advanceTimersByTimeAsync(1_000);
  });

  it("rejects when the host returns a mismatched response type", async () => {
    let requestId = "";
    const { handleHostMessage, request } = createProtocolClientTransport((msg) => {
      requestId = (msg as { requestId: string }).requestId;
    });

    const pending = request("status.list", { repoId: "r1" }, 1_000);
    handleHostMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      type: "repo.snapshot",
      ok: true,
      payload: {},
    });

    await expect(pending).rejects.toThrow(
      'Unexpected response type "repo.snapshot" for "status.list"',
    );
    await vi.advanceTimersByTimeAsync(1_000);
  });

  it("rejects a pending request when the host replies with another protocol version", async () => {
    let requestId = "";
    const { handleHostMessage, request } = createProtocolClientTransport((msg) => {
      requestId = (msg as { requestId: string }).requestId;
    });

    const pending = request("status.list", { repoId: "r1" }, 1_000);
    expect(
      handleHostMessage({
        protocolVersion: PROTOCOL_VERSION + 1,
        requestId,
        type: "status.list",
        ok: true,
        payload: { entries: [] },
      }),
    ).toBe(true);

    await expect(pending).rejects.toThrow(
      `Host replied with protocol version ${PROTOCOL_VERSION + 1}, expected ${PROTOCOL_VERSION}`,
    );
    await vi.advanceTimersByTimeAsync(1_000);
  });

  it("settles child-client requests when parent handleHostMessage receives the reply", async () => {
    let requestId = "";
    const parent = createProtocolClientTransport(() => {});
    const child = createProtocolClientTransport((msg) => {
      requestId = (msg as { requestId: string }).requestId;
    });

    const pending = child.request("log.query", { repoId: "r1" }, 1_000);
    parent.handleHostMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      type: "log.query",
      ok: false,
      error: { code: "GIT_ERROR", message: "Repository is not readable." },
    });

    await expect(pending).rejects.toThrow("Repository is not readable.");
    await vi.advanceTimersByTimeAsync(1_000);
  });
});