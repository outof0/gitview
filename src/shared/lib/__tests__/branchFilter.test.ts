import { describe, it, expect, vi } from "vitest";
import { validateBranchFilter } from "../branchFilter";

describe("validateBranchFilter", () => {
  const listBranches = vi.fn(() => Promise.resolve(["main", "feature"]));

  it("accepts undefined branch", async () => {
    expect(await validateBranchFilter(undefined, listBranches, "/repo")).toEqual(
      { ok: true },
    );
  });

  it("accepts known branches", async () => {
    expect(await validateBranchFilter("main", listBranches, "/repo")).toEqual({
      ok: true,
      branch: "main",
    });
  });

  it("rejects unknown branches", async () => {
    expect(
      await validateBranchFilter("missing", listBranches, "/repo"),
    ).toMatchObject({
      ok: false,
      message: "Unknown branch filter.",
    });
  });

  it("rejects option-like branches", async () => {
    expect(
      await validateBranchFilter("--all", listBranches, "/repo"),
    ).toMatchObject({
      ok: false,
      message: "Invalid branch filter.",
    });
  });
});