import { describe, it, expect } from "vitest";
import { buildMergeDocument } from "../mergeDocument";
import {
  acceptOurs,
  acceptTheirs,
  acceptBoth,
  acceptSide,
  appendSide,
  resetBlock,
  ignoreSide,
  manualEdit,
  allConflictsResolved,
} from "../resolve";
import { reflowResultRanges, serializeResult } from "../serialize";
import { hasLeftoverMarkers } from "../markers";

function doc() {
  return buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/app.ts",
    absolutePath: "/repo/src/app.ts",
    base: "a\nb\nc\n",
    ours: "a\nX\nc\n",
    theirs: "a\nY\nc\n",
    worktree: "a\n<<<<<<< HEAD\nX\n=======\nY\n>>>>>>> main\nc\n",
    now: 1,
  });
}

describe("mergeDocument", () => {
  it("builds blocks, orders, labels, eol, final newline", () => {
    const d = doc();
    expect(d.eol).toBe("lf");
    expect(d.hasFinalNewline).toBe(true);
    expect(d.oursLabel).toBe("HEAD");
    expect(d.theirsLabel).toBe("main");
    expect(d.conflictOrder.length).toBe(1);
    expect(d.blocks.length).toBeGreaterThanOrEqual(2);
  });

  it("initial result keeps the base text in unresolved conflicts", () => {
    const d = doc();
    expect(d.result).toBe("a\nb\nc\n");
    expect(hasLeftoverMarkers(d.result)).toBe(false);
  });
});

describe("resolve actions + serialize round-trip", () => {
  it("accept ours fills the conflict; result has no markers", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    let blocks = d.blocks.map((b) => (b.id === cid ? acceptOurs(b) : b));
    blocks = reflowResultRanges(blocks);
    const out = serializeResult(blocks, d.eol, d.hasFinalNewline);
    expect(out).toBe("a\nX\nc\n");
    expect(hasLeftoverMarkers(out)).toBe(false);
  });

  it("accept theirs", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    let blocks = d.blocks.map((b) => (b.id === cid ? acceptTheirs(b) : b));
    blocks = reflowResultRanges(blocks);
    expect(serializeResult(blocks, d.eol, d.hasFinalNewline)).toBe("a\nY\nc\n");
  });

  it("accept both, ours first", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    let blocks = d.blocks.map((b) =>
      b.id === cid ? acceptBoth(b, "oursFirst") : b,
    );
    blocks = reflowResultRanges(blocks);
    expect(serializeResult(blocks, d.eol, d.hasFinalNewline)).toBe(
      "a\nX\nY\nc\n",
    );
  });

  it("accept side keeps the other conflict side pending", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const accepted = acceptSide(d.blocks.find((b) => b.id === cid)!, "ours");
    expect(accepted.status).toBe("unresolved");
    expect(accepted.resultText).toBe("X");
    expect(accepted.metadata.conflict).toEqual({
      ours: "accepted",
      theirs: "pending",
      acceptedOrder: ["ours"],
    });
  });

  it("append without prior other-side accept is a no-op", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const block = d.blocks.find((b) => b.id === cid)!;
    const appended = appendSide(block, "theirs");
    expect(appended).toBe(block);
    expect(appended.status).toBe("unresolved");
  });

  it("append after accepting one side resolves to both sides in order", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const accepted = acceptSide(d.blocks.find((b) => b.id === cid)!, "ours");
    const appended = appendSide(accepted, "theirs");
    expect(appended.status).toBe("accepted_both");
    expect(appended.resultText).toBe("X\nY");
    expect(appended.metadata.conflict).toEqual({
      ours: "accepted",
      theirs: "accepted",
      acceptedOrder: ["ours", "theirs"],
    });
  });

  it("ignore after accepting one side finalizes the selected side", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const accepted = acceptSide(d.blocks.find((b) => b.id === cid)!, "ours");
    const resolved = ignoreSide(accepted, "theirs");
    expect(resolved.status).toBe("accepted_ours");
    expect(resolved.resultText).toBe("X");
    expect(resolved.metadata.conflict).toEqual({
      ours: "accepted",
      theirs: "ignored",
      acceptedOrder: ["ours"],
    });
  });

  it("ignoring both sides resolves back to base", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const ignoredOurs = ignoreSide(d.blocks.find((b) => b.id === cid)!, "ours");
    expect(ignoredOurs.status).toBe("unresolved");
    expect(ignoredOurs.resultText).toBe("b");
    const resolved = ignoreSide(ignoredOurs, "theirs");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resultText).toBe("b");
  });

  it("reset returns conflict to unresolved/base", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const accepted = acceptOurs(d.blocks.find((b) => b.id === cid)!);
    expect(accepted.status).toBe("accepted_ours");
    const reset = resetBlock(accepted);
    expect(reset.status).toBe("unresolved");
    expect(reset.resultText).toBe("b");
  });

  it("manual edit flips status and marks edited", () => {
    const d = doc();
    const cid = d.conflictOrder[0];
    const edited = manualEdit(d.blocks.find((b) => b.id === cid)!, "Z");
    expect(edited.status).toBe("manual");
    expect(edited.metadata.hasManualEdit).toBe(true);
    expect(edited.resultText).toBe("Z");
  });

  it("allConflictsResolved tracks completion", () => {
    const d = doc();
    expect(allConflictsResolved(d.blocks)).toBe(false);
    const cid = d.conflictOrder[0];
    const blocks = d.blocks.map((b) => (b.id === cid ? acceptOurs(b) : b));
    expect(allConflictsResolved(blocks)).toBe(true);
  });

  it("uses markers engine when mergeEngine is markers", () => {
    const worktree =
      "keep\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> main\n";
    const threeWay = buildMergeDocument({
      repoRoot: "/r",
      relativePath: "f",
      absolutePath: "/r/f",
      base: "keep\nsame\n",
      ours: "keep\nours-line\n",
      theirs: "keep\nsame\n",
      worktree,
      mergeEngine: "threeWay",
      now: 1,
    });
    const markers = buildMergeDocument({
      repoRoot: "/r",
      relativePath: "f",
      absolutePath: "/r/f",
      base: "ignored-by-markers",
      ours: "ignored",
      theirs: "ignored",
      worktree,
      mergeEngine: "markers",
      now: 1,
    });

    expect(threeWay.blocks.some((b) => b.kind === "ours_only")).toBe(true);
    expect(markers.blocks.every((b) => b.kind !== "ours_only")).toBe(true);
    expect(markers.conflictOrder).toHaveLength(1);
    expect(markers.blocks.find((b) => b.kind === "conflict")?.oursText).toBe(
      "ours",
    );
  });

  it("markers engine resolve round-trip produces marker-free output", () => {
    const worktree =
      "keep\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> main\n";
    const d = buildMergeDocument({
      repoRoot: "/r",
      relativePath: "f",
      absolutePath: "/r/f",
      base: "ignored",
      ours: "ignored",
      theirs: "ignored",
      worktree,
      mergeEngine: "markers",
      now: 1,
    });
    const cid = d.conflictOrder[0];
    let blocks = d.blocks.map((b) => (b.id === cid ? acceptOurs(b) : b));
    blocks = reflowResultRanges(blocks);
    const out = serializeResult(blocks, d.eol, d.hasFinalNewline);
    expect(out).toBe("keep\nours\n");
    expect(hasLeftoverMarkers(out)).toBe(false);
  });

  it("preserves crlf and no-final-newline on serialize", () => {
    const d = buildMergeDocument({
      repoRoot: "/r",
      relativePath: "f",
      absolutePath: "/r/f",
      base: "a\r\nb",
      ours: "a\r\nX",
      theirs: "a\r\nX",
      worktree: "a\r\nX",
      now: 1,
    });
    expect(d.eol).toBe("crlf");
    expect(d.hasFinalNewline).toBe(false);
    // both_same auto-resolves → full content present
    expect(d.result).toBe("a\r\nX");
  });
});
