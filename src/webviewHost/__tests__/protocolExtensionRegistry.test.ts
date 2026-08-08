import { describe, expect, it, vi } from "vitest";
import {
  parseWebviewRequestResult,
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../../shared/protocol";
import { createProtocolExtensionRegistry } from "../protocolExtensionRegistry";

describe("ProtocolExtensionRegistry", () => {
  it("validates, dispatches, and responds to namespaced extension requests", async () => {
    const registry = createProtocolExtensionRegistry();
    const handle = vi.fn(async (request) => ({
      echoed: request.payload.value,
    }));
    registry.register({
      type: "extension.example.echo",
      validate: (payload) =>
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { value?: unknown }).value === "string",
      handle,
    });
    const raw = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: "ext-1",
      type: "extension.example.echo",
      payload: { value: "hello" },
    };
    const parsed = parseWebviewRequestResult(
      raw,
      registry.getPayloadValidators(),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.request.type.startsWith("extension.")) {
      throw new Error("Expected an extension request.");
    }
    const sent: HostToWebview[] = [];

    const handled = await registry.dispatch(
      parsed.request as never,
      { trusted: true, workspaceFolders: [] },
      (message) => sent.push(message),
    );

    expect(handled).toBe(true);
    expect(handle).toHaveBeenCalled();
    expect(sent).toEqual([
      expect.objectContaining({
        requestId: "ext-1",
        type: "extension.example.echo",
        ok: true,
        payload: { echoed: "hello" },
      }),
    ]);
  });

  it("rejects malformed extension payloads and unregisters cleanly", () => {
    const registry = createProtocolExtensionRegistry();
    const registration = registry.register({
      type: "extension.example.number",
      validate: (payload) => typeof payload === "number",
      handle: async () => ({ ok: true }),
    });
    const raw = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: "ext-2",
      type: "extension.example.number",
      payload: "not-a-number",
    };

    expect(
      parseWebviewRequestResult(raw, registry.getPayloadValidators()),
    ).toEqual(expect.objectContaining({ ok: false, code: "INVALID_REQUEST" }));

    registration.dispose();
    expect(
      parseWebviewRequestResult(
        { ...raw, payload: 1 },
        registry.getPayloadValidators(),
      ),
    ).toEqual(expect.objectContaining({ ok: false, code: "INVALID_REQUEST" }));
  });
});
