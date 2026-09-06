import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { isOpenOverlayEvent } from "../branchOverlayGuards";

function event(payload: unknown) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "git.openOverlay",
    payload,
  };
}

describe("isOpenOverlayEvent", () => {
  it("accepts createBranch and branches requests", () => {
    expect(
      isOpenOverlayEvent(
        event({ surface: "createBranch", repoId: "repo", startPoint: "main" }),
      ),
    ).toBe(true);
    expect(
      isOpenOverlayEvent(event({ surface: "branches", repoId: "repo" })),
    ).toBe(true);
  });

  it("rejects unknown surfaces and missing repoId", () => {
    expect(
      isOpenOverlayEvent(event({ surface: "commit", repoId: "repo" })),
    ).toBe(false);
    expect(isOpenOverlayEvent(event({ surface: "branches" }))).toBe(false);
    expect(
      isOpenOverlayEvent(event({ surface: "branches", repoId: "" })),
    ).toBe(false);
  });

  it("rejects non-overlay messages", () => {
    expect(isOpenOverlayEvent(null)).toBe(false);
    expect(isOpenOverlayEvent("git.openOverlay")).toBe(false);
    expect(
      isOpenOverlayEvent({
        protocolVersion: PROTOCOL_VERSION,
        type: "diff.preview",
        payload: {},
      }),
    ).toBe(false);
    expect(
      isOpenOverlayEvent({
        protocolVersion: 0,
        type: "git.openOverlay",
        payload: { surface: "branches", repoId: "repo" },
      }),
    ).toBe(false);
  });
});
