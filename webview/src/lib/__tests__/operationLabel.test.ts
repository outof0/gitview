import { describe, expect, it } from "vitest";
import { operationLabel } from "../operationLabel";

describe("operationLabel", () => {
  it("returns labels for active operations", () => {
    expect(operationLabel({ type: "merge", canContinue: false, canAbort: true })).toBe(
      "Merge in progress",
    );
    expect(
      operationLabel({
        type: "rebase",
        canContinue: true,
        canSkip: true,
        canAbort: true,
      }),
    ).toBe("Rebase in progress");
    expect(
      operationLabel({
        type: "cherry_pick",
        canContinue: true,
        canSkip: true,
        canAbort: true,
      }),
    ).toBe("Cherry-pick in progress");
  });

  it("returns null when no operation is active", () => {
    expect(operationLabel({ type: "none" })).toBeNull();
  });
});