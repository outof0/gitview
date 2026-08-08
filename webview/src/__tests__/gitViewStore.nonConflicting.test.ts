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

    it("applyAllNonConflicting leaves both_same blocks for resolve simple", () => {
      const doc = makeTestDoc("line1\n", "same-change\n", "same-change\n");
      const blocks = doc.blocks.map((b) =>
        b.kind === "both_same" ? { ...b, status: "unresolved" as const } : b,
      );
      useGitViewStore.setState({ activeDocument: { ...doc, blocks } });

      useGitViewStore.getState().applyAllNonConflicting();

      const both = useGitViewStore
        .getState()
        .activeDocument!.blocks.find((b) => b.kind === "both_same");
      expect(both?.status).toBe("unresolved");
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
    it("auto-resolves both_same blocks but leaves real conflicts", () => {
      // both sides make the SAME change → both_same (simple/auto-resolvable).
      const doc = makeTestDoc("line1\n", "same-change\n", "same-change\n");
      useGitViewStore.setState({ activeDocument: doc });
      useGitViewStore.getState().resolveSimpleConflicts();

      const updated = useGitViewStore.getState().activeDocument!;
      const both = updated.blocks.find((b) => b.kind === "both_same");
      if (both) {
        expect(both.status).not.toBe("unresolved");
      }
    });

    it("does not touch a genuine conflict", () => {
      const doc = makeTestDoc(
        "line1\nline2\n",
        "line1\nours-changed\n",
        "line1\ntheirs-changed\n",
      );
      useGitViewStore.setState({ activeDocument: doc });
      useGitViewStore.getState().resolveSimpleConflicts();

      const updated = useGitViewStore.getState().activeDocument!;
      const conflict = updated.blocks.find((b) => b.kind === "conflict");
      expect(conflict?.status).toBe("unresolved");
    });
  });
});
