import { describe, it, expect, beforeEach } from "vitest";
import { useGitViewStore } from "../stores/gitViewStore";
import { makeTestDoc } from "./gitViewStore.testHelpers";

describe("gitViewStore resolution actions", () => {
  beforeEach(() => {
    useGitViewStore.setState({
      activeDocument: null,
      activeBlockId: null,
      undoStack: [],
      redoStack: [],
      screen: "conflictList",
    });
  });

  describe("setActiveDocument", () => {
    it("clears per-document UI state when a new merge document is loaded", () => {
      const doc = makeTestDoc("a\nb\n", "a\nours\n", "a\ntheirs\n");
      useGitViewStore.setState({
        activeBlockId: "b1",
        undoStack: [doc],
        redoStack: [doc],
        searchOpen: true,
        searchQuery: "ours",
        searchActiveIndex: 2,
        error: "That file is not in the current unmerged conflict list.",
      });

      useGitViewStore.getState().setActiveDocument(doc);

      const state = useGitViewStore.getState();
      expect(state.activeDocument).toBe(doc);
      expect(state.activeBlockId).toBeNull();
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
      expect(state.searchOpen).toBe(false);
      expect(state.searchQuery).toBe("");
      expect(state.searchActiveIndex).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe("applyAcceptOurs", () => {
    it("sets conflict block resultText to oursText", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict");
      expect(conflictBlock).toBeDefined();

      useGitViewStore.getState().applyAcceptOurs(conflictBlock!.id);

      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === conflictBlock!.id);
      expect(block?.resultText).toBe("ours-changed");
      expect(block?.status).toBe("accepted_ours");
    });

    it("does nothing for unchanged blocks", () => {
      const doc = makeTestDoc("same\n", "same\n", "same\n");
      useGitViewStore.setState({ activeDocument: doc });

      const unchangedBlock = doc.blocks.find((b) => b.kind === "unchanged");
      expect(unchangedBlock).toBeDefined();

      useGitViewStore.getState().applyAcceptOurs(unchangedBlock!.id);

      const updated = useGitViewStore.getState().activeDocument!;
      expect(updated).toEqual(doc);
    });
  });

  describe("applyAcceptTheirs", () => {
    it("sets conflict block resultText to theirsText", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict");
      useGitViewStore.getState().applyAcceptTheirs(conflictBlock!.id);

      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === conflictBlock!.id);
      expect(block?.resultText).toBe("theirs-changed");
      expect(block?.status).toBe("accepted_theirs");
    });
  });
});
