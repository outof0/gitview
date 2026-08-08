import { useCallback, useMemo, useRef, type MouseEvent } from "react";
import { useGitViewStore } from "../../stores/gitViewStore";
import { useMergeClientContext } from "./mergeClientContext";
import { useManualEdit } from "../useManualEdit";
import {
  buildBlockRows,
  buildBaseRows,
  collapsedBlockIds,
  countChanges,
} from "../../components/merge/rows";
import { buildGitMenuActionPayload, type GitMenuAction } from "@gitview/types";
import type { MergeDocument } from "../../../../src/core/types";
import type { BlameLine } from "@gitview/types";

export type EditorContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  type: "gutter" | "editor";
  side?: "left" | "center" | "right";
  blockId?: string;
};

type UseMergeResolverControllerOpts = {
  activeDocument: MergeDocument | null;
  showBlameLeft: boolean;
  showBlameRight: boolean;
  blameOursLines?: BlameLine[];
  blameTheirsLines?: BlameLine[];
};

export function useMergeResolverController({
  activeDocument,
  showBlameLeft,
  showBlameRight,
  blameOursLines,
  blameTheirsLines,
}: UseMergeResolverControllerOpts) {
  const showBase = useGitViewStore((s) => s.showBase);
  const foldThreshold = useGitViewStore((s) => s.foldThreshold);
  const foldUnchangedRegions = useGitViewStore((s) => s.foldUnchangedRegions);
  const expandedBlocks = useGitViewStore((s) => s.expandedBlocks);
  const client = useMergeClientContext();
  const { applyManualEditToBlock } = useManualEdit();
  const editsRef = useRef(applyManualEditToBlock);
  editsRef.current = applyManualEditToBlock;

  const rowEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const rowRef = useCallback((blockId: string, el: HTMLDivElement | null) => {
    if (el) {
      rowEls.current.set(blockId, el);
    }
  }, []);

  const scrollToBlock = useCallback((blockId: string) => {
    const el = rowEls.current.get(blockId);
    if (!el) {
      return;
    }
    const container =
      (el.closest("[data-testid^='pane-']") as HTMLElement | null) ??
      (el.closest("[data-testid^='pane-']") as HTMLElement | null);
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elTop = elRect.top - containerRect.top + container.scrollTop;
      const top = elTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const rows = useMemo(
    () =>
      activeDocument
        ? buildBlockRows(activeDocument, {
            blameOurs: showBlameLeft ? blameOursLines : undefined,
            blameTheirs: showBlameRight ? blameTheirsLines : undefined,
          })
        : [],
    [
      activeDocument,
      showBlameLeft,
      showBlameRight,
      blameOursLines,
      blameTheirsLines,
    ],
  );

  const baseRows = useMemo(
    () => (activeDocument && showBase ? buildBaseRows(activeDocument) : []),
    [activeDocument, showBase],
  );

  const collapsed = useMemo(
    () =>
      collapsedBlockIds(
        rows,
        foldUnchangedRegions ? foldThreshold : Number.MAX_SAFE_INTEGER,
        expandedBlocks,
      ),
    [rows, foldThreshold, foldUnchangedRegions, expandedBlocks],
  );

  const changeCounts = useMemo(
    () => (activeDocument ? countChanges(activeDocument) : null),
    [activeDocument],
  );

  // Stable identities: the memoized row components below re-render on any
  // handler change, so these must not be rebuilt each render.
  const selectBlock = useCallback(
    (id: string) => useGitViewStore.getState().setActiveBlock(id),
    [],
  );

  const jumpToBlock = useCallback(
    (id: string) => {
      selectBlock(id);
      scrollToBlock(id);
    },
    [selectBlock, scrollToBlock],
  );

  const editBlock = useCallback((blockId: string, text: string) => {
    const doc = useGitViewStore.getState().activeDocument;
    if (!doc) {
      return;
    }
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) {
      return;
    }
    editsRef.current(block.id, text);
  }, []);

  const expand = useCallback(
    (id: string) => useGitViewStore.getState().expandBlock(id),
    [],
  );

  const dispatchGitAction = useCallback(
    (action: GitMenuAction) => {
      if (!activeDocument) {
        return;
      }
      if (!client.repoId) {
        return;
      }
      void client.menuAction(
        client.repoId,
        buildGitMenuActionPayload(action, {
          relativePath: activeDocument.relativePath,
          isFolder: false,
        }),
      );
    },
    [activeDocument, client],
  );

  const handleMarkResolved = () => {
    if (!activeDocument) {
      return;
    }
    if (!useGitViewStore.getState().isFullyResolved()) {
      useGitViewStore
        .getState()
        .showToast("Resolve all conflicts before applying.", "warning");
      return;
    }
    const content = useGitViewStore.getState().getResultText();
    if (!client.repoId) {
      return;
    }
    void client.markResolved(
      client.repoId,
      activeDocument.relativePath,
      content,
    );
  };

  const parseEditorContextMenu = (e: MouseEvent): EditorContextMenuState => {
    const target = e.target as HTMLElement;
    const isGutterClick =
      !!target.closest(".nx-ln") ||
      !!target.closest(".nx-blame") ||
      !!target.closest(".nx-act") ||
      !!target.closest(".nx-collapsed-banner");

    let side: "left" | "center" | "right" = "center";
    if (target.closest('[data-testid="pane-left-wrap"]')) {
      side = "left";
    } else if (target.closest('[data-testid="pane-right-wrap"]')) {
      side = "right";
    }

    const blockEl = target.closest("[data-block]") as HTMLElement | null;
    let blockId = blockEl?.dataset.block;

    // Single Result Monaco: click target is a .view-line (anchors are
    // pointer-events:none). Map the line index → owning block via resultRange.
    if (!blockId && side === "center") {
      const pane = target.closest(
        '[data-testid="pane-center"]',
      ) as HTMLElement | null;
      const viewLine = target.closest(".view-line") as HTMLElement | null;
      if (pane && viewLine) {
        const lines = Array.from(
          pane.querySelectorAll(".monaco-editor .view-line"),
        );
        const lineIndex = lines.indexOf(viewLine);
        if (lineIndex >= 0) {
          const doc = useGitViewStore.getState().activeDocument;
          const block = doc?.blocks.find(
            (b) =>
              b.resultRange.start <= lineIndex && lineIndex < b.resultRange.end,
          );
          blockId = block?.id;
        }
      }
      if (!blockId) {
        blockId = useGitViewStore.getState().activeBlockId ?? undefined;
      }
    }

    return {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: isGutterClick ? "gutter" : "editor",
      side,
      blockId,
    };
  };

  return {
    rows,
    baseRows,
    collapsed,
    changeCounts,
    rowRef,
    scrollToBlock,
    selectBlock,
    jumpToBlock,
    editBlock,
    expand,
    dispatchGitAction,
    handleMarkResolved,
    parseEditorContextMenu,
  };
}
