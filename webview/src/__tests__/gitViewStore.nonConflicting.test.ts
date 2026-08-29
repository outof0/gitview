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
      statusMessage: null,
    });
  });

  function makeMagicMergeDoc() {
    return makeTestDoc(
      "This is a simple conflict that can be resolved.\n",
      "Below is a simple conflict that can be resolved.\n",
      "This is a simple conflict that can be resolved automatically.\n",
    );
  }

  function makeOverlappingConflictDoc() {
    return makeTestDoc(
      "The color is blue.\n",
      "The color is red.\n",
      "The color is green.\n",
    );
  }

  function makeMixedConflictDoc() {
    return makeTestDoc(
      "This is a simple conflict that can be resolved.\nseparator\nThe color is blue.\n",
      "Below is a simple conflict that can be resolved.\nseparator\nThe color is red.\n",
      "This is a simple conflict that can be resolved automatically.\nseparator\nThe color is green.\n",
    );
  }

  function makeTwoMagicMergeConflictsDoc() {
    return makeTestDoc(
      "This is a simple conflict that can be resolved.\nseparator\nStart and finish.\n",
      "Below is a simple conflict that can be resolved.\nseparator\nBegin and finish.\n",
      "This is a simple conflict that can be resolved automatically.\nseparator\nStart and done.\n",
    );
  }

  describe("applyAllNonConflictingLeft / Right", () => {
    // Non-conflicting blocks are auto-resolved at build time, so force them
    // back to unresolved to exercise the side-specific apply actions.
    function loadUnresolvedNonConflicting() {
      const doc = makeTestDoc(
        "line1\nline2\nline3\n",
        "ours1\nline2\nline3\n",
        "line1\nline2\ntheirs3\n",
      );
      const blocks = doc.blocks.map((b) =>
        b.kind === "ours_only" || b.kind === "theirs_only"
          ? { ...b, status: "unresolved" as const }
          : b,
      );
      useGitViewStore.setState({ activeDocument: { ...doc, blocks } });
    }

    it("applies only ours-side non-conflicting changes from the left", () => {
      loadUnresolvedNonConflicting();
      useGitViewStore.getState().applyAllNonConflictingLeft();

      const updated = useGitViewStore.getState().activeDocument!;
      const oursBlock = updated.blocks.find((b) => b.kind === "ours_only");
      const theirsBlock = updated.blocks.find((b) => b.kind === "theirs_only");
      expect(oursBlock?.status).toBe("accepted_ours");
      // theirs_only should remain untouched by a left-only apply.
      expect(theirsBlock?.status).toBe("unresolved");
    });

    it("applies only theirs-side non-conflicting changes from the right", () => {
      loadUnresolvedNonConflicting();
      useGitViewStore.getState().applyAllNonConflictingRight();

      const updated = useGitViewStore.getState().activeDocument!;
      const oursBlock = updated.blocks.find((b) => b.kind === "ours_only");
      const theirsBlock = updated.blocks.find((b) => b.kind === "theirs_only");
      expect(theirsBlock?.status).toBe("accepted_theirs");
      expect(oursBlock?.status).toBe("unresolved");
    });

    it("applyAllNonConflicting resolves both sides", () => {
      loadUnresolvedNonConflicting();
      useGitViewStore.getState().applyAllNonConflicting();

      const updated = useGitViewStore.getState().activeDocument!;
      expect(
        updated.blocks
          .filter((b) => b.kind === "ours_only" || b.kind === "theirs_only")
          .every((b) => b.status !== "unresolved"),
      ).toBe(true);
    });

    it("leaves Magic Merge candidates for the dedicated action", () => {
      const doc = makeMagicMergeDoc();
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().applyAllNonConflicting();

      const conflict = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.kind === "conflict");
      expect(conflict?.status).toBe("unresolved");
    });
  });

  describe("setCompareMode", () => {
    it("enables base pane for localBase and repoBase", () => {
      useGitViewStore.getState().setCompareMode("localBase");
      expect(useGitViewStore.getState().compareMode).toBe("localBase");
      expect(useGitViewStore.getState().showBase).toBe(true);

      useGitViewStore.getState().setCompareMode("repoBase");
      expect(useGitViewStore.getState().compareMode).toBe("repoBase");
      expect(useGitViewStore.getState().showBase).toBe(true);
    });

    it("preserves showBase when switching to localRepo", () => {
      useGitViewStore.setState({ showBase: true });
      useGitViewStore.getState().setCompareMode("localRepo");
      expect(useGitViewStore.getState().compareMode).toBe("localRepo");
      expect(useGitViewStore.getState().showBase).toBe(true);
    });

    it("resets to default compare mode", () => {
      useGitViewStore.getState().setCompareMode("localMiddle");
      useGitViewStore.getState().setCompareMode("default");
      expect(useGitViewStore.getState().compareMode).toBe("default");
    });
  });

  describe("resolveSimpleConflicts", () => {
    it("combines non-overlapping word edits in a genuine conflict", () => {
      const doc = makeMagicMergeDoc();
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().resolveSimpleConflicts();

      const updated = useGitViewStore.getState().activeDocument!;
      const conflict = updated.blocks.find((b) => b.kind === "conflict")!;
      expect(conflict.status).toBe("resolved");
      expect(conflict.resultText).toBe(
        "Below is a simple conflict that can be resolved automatically.",
      );
      expect(updated.dirty).toBe(true);
      expect(useGitViewStore.getState().undoStack).toHaveLength(1);
      expect(useGitViewStore.getState().statusMessage).toBe(
        "Magic Merge resolved 1 simple conflict.",
      );
    });

    it("leaves overlapping edits untouched without dirtying or adding undo", () => {
      const doc = makeOverlappingConflictDoc();
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().resolveSimpleConflicts();

      const state = useGitViewStore.getState();
      const conflict = state.activeDocument?.blocks.find(
        (b) => b.kind === "conflict",
      );
      expect(state.activeDocument).toBe(doc);
      expect(conflict?.status).toBe("unresolved");
      expect(state.activeDocument?.dirty).toBe(false);
      expect(state.undoStack).toHaveLength(0);
      expect(state.statusMessage).toBeNull();
    });

    it("resolves only eligible blocks in a mixed document", () => {
      const doc = makeMixedConflictDoc();
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().resolveSimpleConflicts();

      const state = useGitViewStore.getState();
      const conflicts = state.activeDocument!.blocks.filter(
        (block) => block.kind === "conflict",
      );
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0]?.status).toBe("resolved");
      expect(conflicts[0]?.resultText).toBe(
        "Below is a simple conflict that can be resolved automatically.",
      );
      expect(conflicts[1]?.status).toBe("unresolved");
      expect(conflicts[1]?.resultText).toBe("The color is blue.");
      expect(state.undoStack).toHaveLength(1);
      expect(state.statusMessage).toBe(
        "Magic Merge resolved 1 simple conflict.",
      );
    });

    it("commits all eligible blocks as one atomic undo step", () => {
      const doc = makeTwoMagicMergeConflictsDoc();
      useGitViewStore.setState({ activeDocument: doc });

      useGitViewStore.getState().resolveSimpleConflicts();

      let state = useGitViewStore.getState();
      expect(
        state.activeDocument?.blocks
          .filter((block) => block.kind === "conflict")
          .every((block) => block.status === "resolved"),
      ).toBe(true);
      expect(state.undoStack).toHaveLength(1);
      expect(state.statusMessage).toBe(
        "Magic Merge resolved 2 simple conflicts.",
      );

      state.undoMerge();
      state = useGitViewStore.getState();
      expect(
        state.activeDocument?.blocks
          .filter((block) => block.kind === "conflict")
          .every((block) => block.status === "unresolved"),
      ).toBe(true);
      expect(state.undoStack).toHaveLength(0);
      expect(state.redoStack).toHaveLength(1);
    });

    it("skips a conflict after either side has been partially accepted", () => {
      const doc = makeMagicMergeDoc();
      const conflict = doc.blocks.find((block) => block.kind === "conflict")!;
      useGitViewStore.setState({ activeDocument: doc });
      useGitViewStore.getState().applyAcceptSide(conflict.id, "ours");
      const partiallyAccepted = useGitViewStore.getState().activeDocument!;
      const undoCount = useGitViewStore.getState().undoStack.length;

      useGitViewStore.getState().resolveSimpleConflicts();

      const state = useGitViewStore.getState();
      expect(state.activeDocument).toBe(partiallyAccepted);
      expect(state.undoStack).toHaveLength(undoCount);
      expect(
        state.activeDocument?.blocks.find((block) => block.id === conflict.id)
          ?.status,
      ).toBe("unresolved");
      expect(state.statusMessage).toBeNull();
    });

    it.each(["manual", "resolved"] as const)(
      "skips a conflict with %s resolution state",
      (status) => {
        const doc = makeMagicMergeDoc();
        const conflict = doc.blocks.find((block) => block.kind === "conflict")!;
        const blocks = doc.blocks.map((block) =>
          block.id === conflict.id
            ? {
                ...block,
                status,
                metadata: {
                  ...block.metadata,
                  hasManualEdit: status === "manual",
                },
              }
            : block,
        );
        const guarded = { ...doc, blocks };
        useGitViewStore.setState({ activeDocument: guarded });

        useGitViewStore.getState().resolveSimpleConflicts();

        const state = useGitViewStore.getState();
        expect(state.activeDocument).toBe(guarded);
        expect(state.undoStack).toHaveLength(0);
        expect(state.statusMessage).toBeNull();
      },
    );

    it("skips special or incomplete three-way documents", () => {
      const special = { ...makeMagicMergeDoc(), special: "add_add" as const };
      useGitViewStore.setState({ activeDocument: special });
      useGitViewStore.getState().resolveSimpleConflicts();
      expect(useGitViewStore.getState().activeDocument).toBe(special);
      expect(useGitViewStore.getState().undoStack).toHaveLength(0);

      for (const field of ["base", "ours", "theirs"] as const) {
        const incomplete = { ...makeMagicMergeDoc(), [field]: null };
        useGitViewStore.setState({
          activeDocument: incomplete,
          undoStack: [],
          statusMessage: null,
        });
        useGitViewStore.getState().resolveSimpleConflicts();
        expect(useGitViewStore.getState().activeDocument).toBe(incomplete);
        expect(useGitViewStore.getState().undoStack).toHaveLength(0);
        expect(useGitViewStore.getState().statusMessage).toBeNull();
      }
    });
  });
});
