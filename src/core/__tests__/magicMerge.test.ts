import { describe, expect, it } from "vitest";
import { MAX_DIFF_LINES } from "../lcs";
import {
  isMagicMergeResolvable,
  resolveMagicMergeBlock,
  tryMagicMerge,
} from "../magicMerge";
import { buildMergeDocument } from "../mergeDocument";
import { acceptSide, manualEdit } from "../resolve";

describe("Magic Merge", () => {
  it("combines the canonical independent word edits", () => {
    expect(
      tryMagicMerge(
        "This is a simple conflict that can be resolved.",
        "Below is a simple conflict that can be resolved.",
        "This is a simple conflict that can be resolved automatically.",
      ),
    ).toBe("Below is a simple conflict that can be resolved automatically.");
  });

  it("combines independent character edits inside a value", () => {
    expect(
      tryMagicMerge("version: 1.0.0", "version: 2.0.0", "version: 1.0.4"),
    ).toBe("version: 2.0.4");
  });

  it("applies identical edits only once", () => {
    expect(tryMagicMerge("alpha", "alpha beta", "alpha beta")).toBe(
      "alpha beta",
    );
  });

  it("combines insertions at different positions", () => {
    expect(tryMagicMerge("ac", "abc", "acd")).toBe("abcd");
  });

  it("rejects competing replacements of the same span", () => {
    expect(tryMagicMerge("mode=old", "mode=local", "mode=incoming")).toBeNull();
  });

  it("rejects different insertions at the same boundary", () => {
    expect(tryMagicMerge("ab", "aXb", "aYb")).toBeNull();
  });

  it("rejects an insertion strictly inside a deleted span", () => {
    expect(tryMagicMerge("abcd", "ad", "abXcd")).toBeNull();
  });

  it("combines insertions adjacent to either edge of a deletion", () => {
    expect(tryMagicMerge("abc", "ac", "aXbc")).toBe("aXc");
    expect(tryMagicMerge("abc", "ac", "abXc")).toBe("aXc");
  });

  it("rejects a deletion overlapping a replacement", () => {
    expect(tryMagicMerge("abc", "ac", "aBc")).toBeNull();
  });

  it("retries with whitespace-insensitive alignment", () => {
    expect(tryMagicMerge("x y", "xy", "x\tz")).toBe("xz");
  });

  it("keeps our formatting for the same whitespace-insensitive edit", () => {
    expect(tryMagicMerge("old", "new value", "new\tvalue")).toBe(
      "new value",
    );
  });

  it("preserves base CRLF when only whitespace alignment differs", () => {
    expect(tryMagicMerge("x\r\ny", "x\nz", "x y!")).toBe("x\r\nz!");
  });

  it("combines independent edits across CRLF lines", () => {
    expect(
      tryMagicMerge(
        "alpha\r\nbeta\r\n",
        "ALPHA\r\nbeta\r\n",
        "alpha\r\nBETA\r\n",
      ),
    ).toBe("ALPHA\r\nBETA\r\n");
  });

  it("combines independent punctuation edits", () => {
    expect(tryMagicMerge("f(a, b);", "f(x, b);", "f(a, b)!")).toBe(
      "f(x, b)!",
    );
  });

  it("rejects competing punctuation at one span", () => {
    expect(tryMagicMerge("ready.", "ready!", "ready?")).toBeNull();
  });

  it("rejects a deletion whose repeated-character location is ambiguous", () => {
    expect(tryMagicMerge("aaa", "aa", "baa")).toBeNull();
  });

  it("rejects insertions with an ambiguous repeated anchor", () => {
    expect(tryMagicMerge("a", "ba", "aba")).toBeNull();
  });

  it("rejects a transposition with multiple valid LCS alignments", () => {
    expect(tryMagicMerge("ab", "ba", "ac")).toBeNull();
  });

  it("preserves Unicode while combining distant edits", () => {
    expect(
      tryMagicMerge(
        "😀 alpha omega",
        "✨ alpha omega",
        "😀 alpha final",
      ),
    ).toBe("✨ alpha final");
  });

  it("fails closed when the character diff exceeds its size budget", () => {
    const base = "a".repeat(MAX_DIFF_LINES + 1);
    const ours = `b${base.slice(1)}`;
    const theirs = `${base.slice(0, -1)}c`;
    expect(tryMagicMerge(base, ours, theirs)).toBeNull();
  });

  it("resolves an eligible block immutably and clears side state", () => {
    const document = buildMergeDocument({
      repoRoot: "/repo",
      relativePath: "magic.txt",
      absolutePath: "/repo/magic.txt",
      base: "version: 1.0.0\n",
      ours: "version: 2.0.0\n",
      theirs: "version: 1.0.4\n",
      worktree: "version: 2.0.0\n",
    });
    const block = document.blocks.find((candidate) =>
      candidate.kind === "conflict",
    )!;

    expect(isMagicMergeResolvable(block)).toBe(true);
    const resolved = resolveMagicMergeBlock(block);

    expect(resolved).not.toBe(block);
    expect(block.status).toBe("unresolved");
    expect(resolved.kind).toBe("conflict");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resultText).toBe("version: 2.0.4");
    expect(resolved.metadata.hasManualEdit).toBe(false);
    expect(resolved.metadata.conflict).toBeUndefined();
  });

  it("does not overwrite partial or manual conflict work", () => {
    const document = buildMergeDocument({
      repoRoot: "/repo",
      relativePath: "magic.txt",
      absolutePath: "/repo/magic.txt",
      base: "version: 1.0.0\n",
      ours: "version: 2.0.0\n",
      theirs: "version: 1.0.4\n",
      worktree: "version: 2.0.0\n",
    });
    const block = document.blocks.find((candidate) =>
      candidate.kind === "conflict",
    )!;
    const partial = acceptSide(block, "ours");
    const edited = manualEdit(block, "reviewed by hand");

    expect(isMagicMergeResolvable(partial)).toBe(false);
    expect(resolveMagicMergeBlock(partial)).toBe(partial);
    expect(isMagicMergeResolvable(edited)).toBe(false);
    expect(resolveMagicMergeBlock(edited)).toBe(edited);
  });
});
