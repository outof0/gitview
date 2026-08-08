// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { buildMergeDocument } from "../../../../src/core/mergeDocument";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useManualEdit } from "../useManualEdit";

function loadDoc() {
  const doc = buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "src/app.ts",
    absolutePath: "/repo/src/app.ts",
    base: "a\nb\nc\n",
    ours: "a\nours\nc\n",
    theirs: "a\ntheirs\nc\n",
    worktree: "a\nours\nc\n",
    now: 1,
  });
  const conflict = doc.blocks.find((b) => b.kind === "conflict")!;
  useGitViewStore.setState({ activeDocument: doc, activeBlockId: conflict.id });
  return { doc, conflict };
}

describe("useManualEdit", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      undoStack: [],
      redoStack: [],
    });
  });

  it("marks a conflict block manual and dirty after editing", () => {
    const { conflict } = loadDoc();
    const { result } = renderHook(() => useManualEdit());

    act(() => {
      result.current.applyManualEditToBlock(conflict.id, "edited");
    });

    const updated = useGitViewStore.getState().activeDocument!;
    const block = updated.blocks.find((b) => b.id === conflict.id)!;
    expect(block.status).toBe("manual");
    expect(block.resultText).toBe("edited");
    expect(updated.dirty).toBe(true);
    expect(updated.result).toContain("edited");
  });

  it("blocks stale accept after manual edit", () => {
    const { conflict } = loadDoc();
    const { result } = renderHook(() => useManualEdit());

    act(() => {
      result.current.applyManualEditToBlock(conflict.id, "edited");
    });

    const before = useGitViewStore.getState().activeDocument!;
    useGitViewStore.getState().applyAcceptSide(conflict.id, "ours");
    const after = useGitViewStore.getState().activeDocument!;

    expect(after.blocks.find((b) => b.id === conflict.id)?.resultText).toBe(
      before.blocks.find((b) => b.id === conflict.id)?.resultText,
    );
    expect(after.blocks.find((b) => b.id === conflict.id)?.status).toBe(
      "manual",
    );
  });
});