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

  describe("conflict navigation", () => {
    it("skips already resolved conflict blocks", () => {
      const doc = makeTestDoc(
        "a\nb\nc\nd\ne\n",
        "a\nours1\nc\nours2\ne\n",
        "a\ntheirs1\nc\ntheirs2\ne\n",
      );
      useGitViewStore.setState({
        activeDocument: doc,
        activeBlockId: doc.conflictOrder[0],
      });

      useGitViewStore.getState().applyAcceptOurs(doc.conflictOrder[0]!);
      useGitViewStore.getState().goToNextConflict();

      expect(useGitViewStore.getState().activeBlockId).toBe(doc.conflictOrder[1]);
    });
  });

  describe("undoMerge / redoMerge", () => {
    it("undoes and redoes resolution commits", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({
        activeDocument: doc,
        undoStack: [],
        redoStack: [],
      });
      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;

      useGitViewStore.getState().applyAcceptOurs(conflictBlock.id);
      expect(
        useGitViewStore
          .getState()
          .activeDocument!.blocks.find((b) => b.id === conflictBlock.id)
          ?.status,
      ).toBe("accepted_ours");

      useGitViewStore.getState().undoMerge();
      expect(
        useGitViewStore
          .getState()
          .activeDocument!.blocks.find((b) => b.id === conflictBlock.id)
          ?.status,
      ).toBe("unresolved");

      useGitViewStore.getState().redoMerge();
      expect(
        useGitViewStore
          .getState()
          .activeDocument!.blocks.find((b) => b.id === conflictBlock.id)
          ?.status,
      ).toBe("accepted_ours");
    });
  });

  describe("applyResetConflict", () => {
    it("resets conflict block to base", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict");
      useGitViewStore.getState().applyAcceptOurs(conflictBlock!.id);
      useGitViewStore.getState().applyResetConflict(conflictBlock!.id);

      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === conflictBlock!.id);
      expect(block?.resultText).toBe("line2");
      expect(block?.status).toBe("unresolved");
    });

    it("applyRevertCenterBlock restores applied ours_only to base", () => {
      const doc = makeTestDoc("base\n", "modified\n", "base\n");
      useGitViewStore.setState({ activeDocument: doc });
      const oursBlock = doc.blocks.find((b) => b.kind === "ours_only");
      expect(oursBlock).toBeDefined();
      if (!oursBlock) {
        return;
      }
      useGitViewStore.getState().applyRevertCenterBlock(oursBlock.id);
      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === oursBlock.id);
      expect(block?.resultText).toBe("base");
      expect(block?.status).toBe("unresolved");
    });

    it("resets ours_only block to oursText", () => {
      const doc = makeTestDoc("base\n", "modified\n", "base\n");
      useGitViewStore.setState({ activeDocument: doc });

      const oursBlock = doc.blocks.find((b) => b.kind === "ours_only");
      if (oursBlock) {
        useGitViewStore.getState().applyResetConflict(oursBlock.id);

        const updated = useGitViewStore.getState().activeDocument!;
        const block = updated.blocks.find((b) => b.id === oursBlock.id);
        expect(block?.resultText).toBe("modified");
        expect(block?.status).toBe("resolved");
      }
    });
  });

  describe("acceptAllOurs", () => {
    it("accepts ours for all unresolved conflicts", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().acceptAllOurs();

      const updated = useGitViewStore.getState().activeDocument!;
      const conflicts = updated.blocks.filter((b) => b.kind === "conflict");
      for (const block of conflicts) {
        expect(block.status).toBe("accepted_ours");
      }
    });
  });

  describe("acceptAllTheirs", () => {
    it("accepts theirs for all unresolved conflicts", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().acceptAllTheirs();

      const updated = useGitViewStore.getState().activeDocument!;
      const conflicts = updated.blocks.filter((b) => b.kind === "conflict");
      for (const block of conflicts) {
        expect(block.status).toBe("accepted_theirs");
      }
    });
  });

  describe("acceptAndNext", () => {
    it("keeps focus on a partially accepted conflict", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflicts = doc.conflictOrder;
      if (conflicts.length > 0) {
        useGitViewStore.setState({ activeBlockId: conflicts[0] });
        useGitViewStore.getState().acceptAndNext(conflicts[0]!, "ours");

        const updated = useGitViewStore.getState();
        const block = updated.activeDocument?.blocks.find(
          (b) => b.id === conflicts[0],
        );
        expect(block?.status).toBe("unresolved");
        expect(block?.metadata.conflict).toEqual({
          ours: "accepted",
          theirs: "pending",
          acceptedOrder: ["ours"],
        });
        expect(updated.activeBlockId).toBe(conflicts[0]);
      }
    });
  });
});
