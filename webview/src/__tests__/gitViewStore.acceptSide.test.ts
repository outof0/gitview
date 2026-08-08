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

  describe("applyAcceptSide", () => {
    it("accepts one side and keeps the other conflict side pending", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "ours");

      const block = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("ours-changed");
      expect(block?.status).toBe("unresolved");
      expect(block?.metadata.conflict).toEqual({
        ours: "accepted",
        theirs: "pending",
        acceptedOrder: ["ours"],
      });
      expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
    });

    it("accepts the repository side and keeps the local side pending", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "theirs");

      const block = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("theirs-changed");
      expect(block?.status).toBe("unresolved");
      expect(block?.metadata.conflict).toEqual({
        ours: "pending",
        theirs: "accepted",
        acceptedOrder: ["theirs"],
      });
      expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
    });

    it("can append the remaining side after accepting one side", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "ours");
      useGitViewStore.getState().applyAppendSide(conflictBlock.id, "theirs");

      const block = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("ours-changed\ntheirs-changed");
      expect(block?.status).toBe("accepted_both");
      expect(block?.metadata.conflict).toEqual({
        ours: "accepted",
        theirs: "accepted",
        acceptedOrder: ["ours", "theirs"],
      });
      expect(useGitViewStore.getState().remainingConflicts()).toBe(0);
    });

    it("can ignore the remaining side after accepting one side", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "ours");
      useGitViewStore.getState().applyIgnore(conflictBlock.id, "theirs");

      const block = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("ours-changed");
      expect(block?.status).toBe("accepted_ours");
      expect(block?.metadata.conflict).toEqual({
        ours: "accepted",
        theirs: "ignored",
        acceptedOrder: ["ours"],
      });
      expect(useGitViewStore.getState().remainingConflicts()).toBe(0);
    });

    it("does not rewrite an already resolved conflict from a stale action", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({
        activeDocument: doc,
        activeBlockId: doc.conflictOrder[0],
      });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "ours");
      useGitViewStore.getState().applyIgnore(conflictBlock.id, "theirs");
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "theirs");
      useGitViewStore.getState().applyAppendSide(conflictBlock.id, "theirs");
      useGitViewStore.getState().applyIgnore(conflictBlock.id, "ours");

      const state = useGitViewStore.getState();
      const block = state.activeDocument!.blocks.find(
        (b) => b.id === conflictBlock.id,
      );
      expect(block?.resultText).toBe("ours-changed");
      expect(block?.status).toBe("accepted_ours");
      expect(block?.metadata.conflict).toEqual({
        ours: "accepted",
        theirs: "ignored",
        acceptedOrder: ["ours"],
      });
      expect(state.remainingConflicts()).toBe(0);
      expect(state.undoStack).toHaveLength(2);
    });
  });

  describe("applyAcceptBoth", () => {
    it("concatenates ours and theirs", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict");
      useGitViewStore.getState().applyAcceptBoth(conflictBlock!.id);

      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === conflictBlock!.id);
      expect(block?.resultText).toBe("ours-changed\ntheirs-changed");
      expect(block?.status).toBe("accepted_both");
    });
  });

  describe("applyAppendSide", () => {
    it("does not append when the other side has not been accepted", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAppendSide(conflictBlock.id, "theirs");
      expect(useGitViewStore.getState().remainingConflicts()).toBe(1);

      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.status).toBe("unresolved");
      expect(block?.metadata.conflict).toEqual({
        ours: "pending",
        theirs: "pending",
        acceptedOrder: [],
      });
    });

    it("appends both sides after the other side is accepted", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyAcceptSide(conflictBlock.id, "ours");
      useGitViewStore.getState().applyAppendSide(conflictBlock.id, "theirs");
      expect(useGitViewStore.getState().remainingConflicts()).toBe(0);

      const updated = useGitViewStore.getState().activeDocument!;
      const block = updated.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("ours-changed\ntheirs-changed");
      expect(block?.status).toBe("accepted_both");
    });
  });

  describe("applyIgnore", () => {
    it("ignores one side but keeps the conflict unresolved while the other side is pending", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyIgnore(conflictBlock.id, "ours");

      const block = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("line2");
      expect(block?.status).toBe("unresolved");
      expect(block?.metadata.conflict).toEqual({
        ours: "ignored",
        theirs: "pending",
        acceptedOrder: [],
      });
      expect(useGitViewStore.getState().remainingConflicts()).toBe(1);
    });

    it("ignoring both conflict sides resolves to the base text", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });

      const conflictBlock = doc.blocks.find((b) => b.kind === "conflict")!;
      useGitViewStore.getState().applyIgnore(conflictBlock.id, "ours");
      useGitViewStore.getState().applyIgnore(conflictBlock.id, "theirs");

      const block = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.id === conflictBlock.id);
      expect(block?.resultText).toBe("line2");
      expect(block?.status).toBe("resolved");
      expect(useGitViewStore.getState().remainingConflicts()).toBe(0);
    });
  });
});
