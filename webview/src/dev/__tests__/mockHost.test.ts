import { describe, it, expect } from "vitest";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import type { HostToWebview } from "@gitview/shared/protocol";
import { createMockHost } from "../mockHost";
import { createPlaygroundFixtures } from "../fixtures";

describe("playground mockHost", () => {
  function hostWithCapture() {
    const outbound: HostToWebview[] = [];
    const host = createMockHost(createPlaygroundFixtures(), {
      dispatch: (msg) => outbound.push(msg),
    });
    return { host, outbound };
  }

  it("webview.ready for merge replies with merge.init then conflict.snapshot", () => {
    const { host, outbound } = hostWithCapture();
    host.handleMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "r1",
      type: "webview.ready",
      payload: { surface: "merge" },
    });

    expect(outbound.map((m) => m.type)).toEqual([
      "webview.ready",
      "merge.init",
      "conflict.snapshot",
    ]);
    if (outbound[1]?.type === "merge.init") {
      expect(outbound[1].payload.settings.mergeEngine).toBe("threeWay");
    }
  });

  it("merge.openFile returns a merge document", () => {
    const { host, outbound } = hostWithCapture();
    host.handleMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "r2",
      type: "merge.openFile",
      payload: { repoId: "playground-repo", path: "src/app.ts" },
    });

    expect(outbound.some((m) => m.type === "merge.document")).toBe(true);
    expect(outbound.some((m) => m.type === "merge.openFile")).toBe(true);
  });

  it("pushSettings emits merge.settings", () => {
    const { host, outbound } = hostWithCapture();
    host.pushSettings({ showBasePanel: true });

    expect(outbound[0]?.type).toBe("merge.settings");
    expect(host.getSettings().showBasePanel).toBe(true);
  });
});