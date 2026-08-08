import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { isDiffPreview, isErrorNotification } from "../gitDiffHostMessageGuards";

describe("gitDiffHostMessageGuards", () => {
  it("matches diff.preview host events", () => {
    const event = {
      protocolVersion: PROTOCOL_VERSION,
      type: "diff.preview",
      payload: {
        relativePath: "a.ts",
        title: "a.ts",
        diff: {
          layout: "split",
          status: "M",
          left: null,
          right: null,
        },
      },
    };
    expect(isDiffPreview(event)).toBe(true);
  });

  it("rejects legacy git:diffPreview strings", () => {
    expect(
      isDiffPreview({ type: "git:diffPreview", payload: { relativePath: "a.ts" } }),
    ).toBe(false);
  });

  it("matches error notifications", () => {
    expect(
      isErrorNotification({
        protocolVersion: PROTOCOL_VERSION,
        type: "notification",
        payload: { level: "error", message: "boom" },
      }),
    ).toBe(true);
  });
});