import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import { serializeResult } from "../../../src/core/serialize";
import {
  applyManualToBlock,
  makeTestDoc,
  conflictId,
  blockOf,
} from "./resolutionStateMatrix.helpers";

describe("resolution state matrix edge cases", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      undoStack: [],
      redoStack: [],
      screen: "conflictList",
    });
  });

  it("stale accept local cannot rewrite manual content", () => {
    const doc = makeTestDoc(
      "line1\nline2\nline3\n",
      "line1\nours-changed\nline3\n",
      "line1\ntheirs-changed\nline3\n",
    );
    const id = conflictId(doc);
    useGitViewStore.setState({ activeDocument: doc });
    applyManualToBlock(doc, id, "locked-manual");
    useGitViewStore.getState().applyAcceptSide(id, "ours");

    const block = blockOf(useGitViewStore.getState().activeDocument!, id);
    expect(block.status).toBe("manual");
    expect(block.resultText).toBe("locked-manual");
  });

  it("stale append repository cannot rewrite manual content", () => {
    const doc = makeTestDoc(
      "line1\nline2\nline3\n",
      "line1\nours-changed\nline3\n",
      "line1\ntheirs-changed\nline3\n",
    );
    const id = conflictId(doc);
    useGitViewStore.setState({ activeDocument: doc });
    applyManualToBlock(doc, id, "locked-manual");
    useGitViewStore.getState().applyAppendSide(id, "theirs");

    const block = blockOf(useGitViewStore.getState().activeDocument!, id);
    expect(block.status).toBe("manual");
    expect(block.resultText).toBe("locked-manual");
  });

  it("stale ignore local cannot rewrite accepted repository content", () => {
    const doc = makeTestDoc(
      "line1\nline2\nline3\n",
      "line1\nours-changed\nline3\n",
      "line1\ntheirs-changed\nline3\n",
    );
    const id = conflictId(doc);
    useGitViewStore.setState({ activeDocument: doc });
    useGitViewStore.getState().applyAcceptSide(id, "theirs");
    useGitViewStore.getState().applyIgnore(id, "ours");

    const block = blockOf(useGitViewStore.getState().activeDocument!, id);
    expect(block.resultText).toBe("theirs-changed");
    expect(block.metadata.conflict?.theirs).toBe("accepted");
  });

  it("undo/redo restores block status and serialized output", () => {
    const doc = makeTestDoc(
      "line1\nline2\nline3\n",
      "line1\nours-changed\nline3\n",
      "line1\ntheirs-changed\nline3\n",
    );
    const id = conflictId(doc);
    useGitViewStore.setState({ activeDocument: doc });
    useGitViewStore.getState().applyAcceptSide(id, "ours");
    const afterAccept = serializeResult(
      useGitViewStore.getState().activeDocument!.blocks,
      doc.eol,
      doc.hasFinalNewline,
    );

    useGitViewStore.getState().undoMerge();
    expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
    expect(useGitViewStore.getState().getResultText()).not.toBe(afterAccept);

    useGitViewStore.getState().redoMerge();
    expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
    expect(blockOf(useGitViewStore.getState().activeDocument!, id).resultText).toBe(
      "ours-changed",
    );
  });

  it("partial accept local updates serialized result with ours text", () => {
    const doc = makeTestDoc(
      "line1\nline2\nline3\n",
      "line1\nours-changed\nline3\n",
      "line1\ntheirs-changed\nline3\n",
    );
    useGitViewStore.setState({ activeDocument: doc });
    useGitViewStore.getState().applyAcceptSide(conflictId(doc), "ours");

    const serialized = useGitViewStore.getState().getResultText();
    expect(serialized).toContain("ours-changed");
    expect(serialized).not.toContain("theirs-changed");
    expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
  });

  it("undo/redo round-trips manual edit and reset", () => {
    const doc = makeTestDoc(
      "line1\nline2\nline3\n",
      "line1\nours-changed\nline3\n",
      "line1\ntheirs-changed\nline3\n",
    );
    const id = conflictId(doc);
    useGitViewStore.setState({ activeDocument: doc });
    applyManualToBlock(doc, id, "edited");
    useGitViewStore.getState().undoMerge();
    expect(blockOf(useGitViewStore.getState().activeDocument!, id).status).toBe(
      "unresolved",
    );
    useGitViewStore.getState().redoMerge();
    expect(blockOf(useGitViewStore.getState().activeDocument!, id).resultText).toBe(
      "edited",
    );
  });
});