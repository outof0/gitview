import { describe, it, expect } from "vitest";
import { buildMergeDocument } from "../../../../src/core/mergeDocument";
import { canAppendSide, getResolveContextMenuMode } from "../mergeResolveMenu";

describe("mergeResolveMenu", () => {
  const doc = buildMergeDocument({
    repoRoot: "/r",
    relativePath: "src/app.ts",
    absolutePath: "/r/src/app.ts",
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
  });

  it("returns full mode for unresolved conflicts", () => {
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(getResolveContextMenuMode(conflict)).toBe("full");
  });

  it("returns reset-only for resolved conflicts", () => {
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(
      getResolveContextMenuMode({ ...conflict, status: "accepted_ours" }),
    ).toBe("reset-only");
  });

  it("returns reset-only for manual conflict edits", () => {
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(
      getResolveContextMenuMode({
        ...conflict,
        status: "manual",
        resultText: "edited",
      }),
    ).toBe("reset-only");
  });

  it("returns none for unchanged blocks", () => {
    const unchanged = doc.blocks.find((b) => b.kind === "unchanged")!;
    expect(getResolveContextMenuMode(unchanged)).toBe("none");
  });

  it("canAppendSide is false on a fresh conflict", () => {
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    expect(canAppendSide(conflict, "ours")).toBe(false);
    expect(canAppendSide(conflict, "theirs")).toBe(false);
  });

  it("canAppendSide is true only after the other side is accepted", () => {
    const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
    const partial = {
      ...conflict,
      metadata: {
        ...conflict.metadata,
        conflict: {
          ours: "pending" as const,
          theirs: "accepted" as const,
          acceptedOrder: ["theirs" as const],
        },
      },
    };
    expect(canAppendSide(partial, "ours")).toBe(true);
    expect(canAppendSide(partial, "theirs")).toBe(false);
  });
});