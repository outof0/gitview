import type { ConflictSide } from "../../../src/core/types";
import {
  acceptOurs,
  acceptTheirs,
  acceptBoth,
  acceptSide,
  appendSide,
  ignoreSide,
  resetBlock,
  revertAppliedChange,
  reflowResultRanges,
  serializeResult,
} from "../../../src/core";
import type { StoreApi } from "zustand";
import { canApplyResolutionAction } from "./mergeResolveMenu";
import {
  conflictSideStatus,
  recomputeDocument,
  updateBlock,
} from "./gitViewStoreHelpers";
import type { GitViewState } from "./gitViewStoreTypes";

type Set = StoreApi<GitViewState>["setState"];
type Get = StoreApi<GitViewState>["getState"];

export function createGitViewStoreResolutionSlice(set: Set, get: Get) {
  return {
    applyAcceptOurs: (id: string) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || !canApplyResolutionAction(block)) {
        return;
      }
      const updated = updateBlock(doc, id, (b) => acceptOurs(b));
      get().commitActiveDocument(updated);
    },

    applyAcceptTheirs: (id: string) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || !canApplyResolutionAction(block)) {
        return;
      }
      const updated = updateBlock(doc, id, (b) => acceptTheirs(b));
      get().commitActiveDocument(updated);
    },

    applyAcceptSide: (id: string, side: ConflictSide) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || !canApplyResolutionAction(block)) {
        return;
      }
      if (
        block.kind === "conflict" &&
        conflictSideStatus(block, side) !== "pending"
      ) {
        return;
      }
      const updated = updateBlock(doc, id, (b) => acceptSide(b, side));
      get().commitActiveDocument(updated);
    },

    applyAcceptBoth: (id: string) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || !canApplyResolutionAction(block)) {
        return;
      }
      const order = get().acceptBothOrder;
      const updated = updateBlock(doc, id, (b) => acceptBoth(b, order));
      get().commitActiveDocument(updated);
    },

    applyAppendSide: (id: string, side: ConflictSide) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || block.kind !== "conflict" || block.status !== "unresolved") {
        return;
      }
      if (conflictSideStatus(block, side) !== "pending") {
        return;
      }
      const other: ConflictSide = side === "ours" ? "theirs" : "ours";
      if (conflictSideStatus(block, other) !== "accepted") {
        return;
      }
      const updated = updateBlock(doc, id, (b) => appendSide(b, side));
      get().commitActiveDocument(updated);
    },

    applyResetConflict: (id: string) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const updated = updateBlock(doc, id, (b) => resetBlock(b));
      get().commitActiveDocument(updated);
    },

    applyRevertCenterBlock: (id: string) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || block.kind === "unchanged") {
        return;
      }
      const updated = updateBlock(doc, id, (b) => revertAppliedChange(b));
      get().commitActiveDocument(updated);
    },

    dismissCrlfBanner: () => set({ crlfBannerDismissed: true }),

    normalizeDocumentEol: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const nl = doc.eol === "crlf" ? "\r\n" : "\n";
      const norm = (text: string) => text.split(/\r\n|\r|\n/).join(nl);
      const blocks = doc.blocks.map((b) => ({
        ...b,
        baseText: norm(b.baseText),
        oursText: b.oursText != null ? norm(b.oursText) : b.oursText,
        theirsText: b.theirsText != null ? norm(b.theirsText) : b.theirsText,
        resultText: norm(b.resultText),
      }));
      const reflowed = reflowResultRanges(blocks);
      const result = serializeResult(reflowed, doc.eol, doc.hasFinalNewline);
      get().commitActiveDocument({
        ...doc,
        blocks: reflowed,
        result,
        worktree: norm(doc.worktree),
        dirty: true,
      });
      set({ crlfBannerDismissed: true });
    },

    applyIgnore: (id: string, side: ConflictSide) => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === id);
      if (!block || !canApplyResolutionAction(block)) {
        return;
      }
      if (
        block.kind === "conflict" &&
        conflictSideStatus(block, side) !== "pending"
      ) {
        return;
      }
      const updated = updateBlock(doc, id, (b) => ignoreSide(b, side));
      get().commitActiveDocument(updated);
    },

    acceptAllOurs: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      let blocks = doc.blocks;
      for (const id of doc.conflictOrder) {
        const block = blocks.find((b) => b.id === id);
        if (block && block.status === "unresolved") {
          blocks = blocks.map((b) => (b.id === id ? acceptOurs(b) : b));
        }
      }
      const updated = recomputeDocument({ ...doc, blocks });
      get().commitActiveDocument(updated);
    },

    acceptAllTheirs: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      let blocks = doc.blocks;
      for (const id of doc.conflictOrder) {
        const block = blocks.find((b) => b.id === id);
        if (block && block.status === "unresolved") {
          blocks = blocks.map((b) => (b.id === id ? acceptTheirs(b) : b));
        }
      }
      const updated = recomputeDocument({ ...doc, blocks });
      get().commitActiveDocument(updated);
    },

    applyAllNonConflicting: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      let blocks = doc.blocks;
      for (const block of blocks) {
        if (block.kind === "ours_only" || block.kind === "theirs_only") {
          if (block.status !== "resolved") {
            const action =
              block.kind === "theirs_only" ? acceptTheirs : acceptOurs;
            blocks = blocks.map((b) => (b.id === block.id ? action(b) : b));
          }
        }
      }
      const updated = recomputeDocument({ ...doc, blocks });
      get().commitActiveDocument(updated);
    },

    // Apply only the LEFT (ours) side's non-conflicting changes.
    applyAllNonConflictingLeft: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      let blocks = doc.blocks;
      for (const block of blocks) {
        if (block.kind === "ours_only" && block.status !== "resolved") {
          blocks = blocks.map((b) => (b.id === block.id ? acceptOurs(b) : b));
        }
      }
      get().commitActiveDocument(recomputeDocument({ ...doc, blocks }));
    },

    // Apply only the RIGHT (theirs) side's non-conflicting changes.
    applyAllNonConflictingRight: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      let blocks = doc.blocks;
      for (const block of blocks) {
        if (block.kind === "theirs_only" && block.status !== "resolved") {
          blocks = blocks.map((b) => (b.id === block.id ? acceptTheirs(b) : b));
        }
      }
      get().commitActiveDocument(recomputeDocument({ ...doc, blocks }));
    },

    // "Resolve simple conflicts": auto-resolve only blocks where ours === theirs
    // (both_same) — the unambiguous case. Real conflicts are left untouched.
    resolveSimpleConflicts: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return;
      }
      let blocks = doc.blocks;
      for (const block of blocks) {
        if (block.kind === "both_same" && block.status !== "resolved") {
          blocks = blocks.map((b) => (b.id === block.id ? acceptOurs(b) : b));
        }
      }
      get().commitActiveDocument(recomputeDocument({ ...doc, blocks }));
    },

    acceptAndNext: (id: string, side: "ours" | "theirs") => {
      const store = get();
      store.applyAcceptSide(id, side);
      const block = get().activeDocument?.blocks.find((b) => b.id === id);
      if (block?.status === "unresolved") {
        set({ activeBlockId: id });
      } else {
        store.goToNextConflict();
      }
    },

    remainingConflicts: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return 0;
      }
      return doc.blocks.filter(
        (b) => b.kind === "conflict" && b.status === "unresolved",
      ).length;
    },

    isFullyResolved: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return false;
      }
      return doc.blocks
        .filter((b) => b.kind === "conflict")
        .every((b) => b.status !== "unresolved");
    },

    getResultText: () => {
      const doc = get().activeDocument;
      if (!doc) {
        return "";
      }
      return serializeResult(doc.blocks, doc.eol, doc.hasFinalNewline);
    },
  };
}